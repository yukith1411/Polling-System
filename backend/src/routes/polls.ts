import { Router } from "express";
import { z } from "zod";
import QRCode from "qrcode";
import { stringify } from "csv-stringify/sync";
import { prisma } from "../lib/prisma";
import { requireTeacherAuth } from "../middleware/auth";
import { generateShareToken } from "../lib/otp";
import { computePollResults } from "../lib/results";
import { getIo, pollRoom } from "../lib/socket";

const router = Router();
router.use(requireTeacherAuth);

function publicOrigin(req: any) {
  const requestedOrigin = typeof req.query.origin === "string" ? req.query.origin : "";
  return /^https?:\/\//.test(requestedOrigin) ? requestedOrigin.replace(/\/$/, "") : process.env.FRONTEND_URL;
}

const createPollSchema = z.object({
  title: z.string().min(1),
  topic: z.string().min(1),
  description: z.string().optional(),
  classId: z.string().min(1),
  options: z.array(z.string().min(1)).min(2, "At least two options are required"),
  allowMultipleAnswer: z.boolean().optional().default(false),
  allowVoteChange: z.boolean().optional().default(false),
  expiresAt: z.string().datetime().optional(),
  // Emails of the students (from the class roster) this poll is authorized for.
  // Frontend provides this via a "select one at a time" checklist or a "select all" toggle.
  authorizedEmails: z.array(z.string().email()).min(1, "Select at least one student"),
});

router.post("/", async (req, res) => {
  const parsed = createPollSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;
  const teacherId = req.teacher!.teacherId;

  const cls = await prisma.class.findFirst({ where: { id: data.classId, teacherId } });
  if (!cls) return res.status(404).json({ error: "Class not found" });

  // Only allow authorizing students who are actually enrolled in this class.
  const enrolled = await prisma.student.findMany({
    where: { enrollments: { some: { classId: data.classId } }, email: { in: data.authorizedEmails.map((e) => e.toLowerCase()) } },
  });
  const enrolledEmails = new Set(enrolled.map((s) => s.email));
  const validAuthorized = data.authorizedEmails.map((e) => e.toLowerCase()).filter((e) => enrolledEmails.has(e));
  if (validAuthorized.length === 0) {
    return res.status(400).json({ error: "None of the selected students are enrolled in this class." });
  }

  const poll = await prisma.poll.create({
    data: {
      title: data.title,
      topic: data.topic,
      description: data.description,
      classId: data.classId,
      teacherId,
      allowMultipleAnswer: data.allowMultipleAnswer,
      allowVoteChange: data.allowVoteChange,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      shareToken: generateShareToken(),
      status: "DRAFT",
      options: { create: data.options.map((text, i) => ({ text, order: i })) },
      authorizedEmails: { create: validAuthorized.map((email) => ({ email })) },
    },
    include: { options: true, authorizedEmails: true },
  });

  res.status(201).json(poll);
});

// List teacher's polls — supports filtering by topic and status for the dashboard ("maintain all poll links").
router.get("/", async (req, res) => {
  const { topic, status } = req.query as { topic?: string; status?: string };
  const polls = await prisma.poll.findMany({
    where: {
      teacherId: req.teacher!.teacherId,
      ...(topic ? { topic: { contains: topic } } : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: { options: { orderBy: { order: "asc" } }, _count: { select: { votes: true, authorizedEmails: true } }, class: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(
    polls.map((p) => ({
      id: p.id,
      title: p.title,
      topic: p.topic,
      status: p.status,
      shareToken: p.shareToken,
      classId: p.classId,
      options: p.options.map((option) => ({ id: option.id, text: option.text })),
      className: p.class.name,
      totalAuthorized: p._count.authorizedEmails,
      totalVoted: p._count.votes,
      createdAt: p.createdAt,
      expiresAt: p.expiresAt,
    }))
  );
});

async function loadOwnedPoll(pollId: string, teacherId: string) {
  return prisma.poll.findFirst({
    where: { id: pollId, teacherId },
    include: { options: true, authorizedEmails: true, class: true },
  });
}

router.get("/:pollId", async (req, res) => {
  const poll = await loadOwnedPoll(req.params.pollId, req.teacher!.teacherId);
  if (!poll) return res.status(404).json({ error: "Poll not found" });
  const results = await computePollResults(poll.id);
  res.json({ poll, results });
});

const statusSchema = z.object({ status: z.enum(["DRAFT", "OPEN", "LOCKED", "CLOSED"]) });

// Lock/unlock/open/close a poll. Locking pauses voting without destroying results —
// exactly the "teacher can lock the poll" control from the spec.
router.patch("/:pollId/status", async (req, res) => {
  const poll = await loadOwnedPoll(req.params.pollId, req.teacher!.teacherId);
  if (!poll) return res.status(404).json({ error: "Poll not found" });

  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updated = await prisma.poll.update({
    where: { id: poll.id },
    data: { status: parsed.data.status },
  });

  getIo().to(pollRoom(poll.id)).emit("poll:status", { pollId: poll.id, status: updated.status });
  res.json(updated);
});

// Update which students are authorized (supports "select one at a time" additions/removals,
// or "select all" by passing the full roster list from the frontend).
const authSchema = z.object({ authorizedEmails: z.array(z.string().email()) });

router.patch("/:pollId/authorized-emails", async (req, res) => {
  const poll = await loadOwnedPoll(req.params.pollId, req.teacher!.teacherId);
  if (!poll) return res.status(404).json({ error: "Poll not found" });

  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const enrolled = await prisma.student.findMany({
    where: { enrollments: { some: { classId: poll.classId } } },
    select: { email: true },
  });
  const enrolledEmails = new Set(enrolled.map((s) => s.email));
  const emails = [...new Set(parsed.data.authorizedEmails.map((e) => e.toLowerCase()))].filter((e) =>
    enrolledEmails.has(e)
  );

  await prisma.$transaction([
    prisma.pollAuthorizedEmail.deleteMany({ where: { pollId: poll.id } }),
    prisma.pollAuthorizedEmail.createMany({ data: emails.map((email) => ({ pollId: poll.id, email })) }),
  ]);

  res.json({ authorizedEmails: emails });
});

// Public-ish share link the teacher pastes into WhatsApp. Includes a ready-made wa.me deep link.
router.get("/:pollId/share", async (req, res) => {
  const poll = await loadOwnedPoll(req.params.pollId, req.teacher!.teacherId);
  if (!poll) return res.status(404).json({ error: "Poll not found" });

  const link = `${publicOrigin(req)}/vote/${poll.shareToken}`;
  const message = encodeURIComponent(`📊 "${poll.title}" — please vote here: ${link}`);
  res.json({
    link,
    whatsappLink: `https://wa.me/?text=${message}`,
  });
});

router.get("/:pollId/qrcode", async (req, res) => {
  const poll = await loadOwnedPoll(req.params.pollId, req.teacher!.teacherId);
  if (!poll) return res.status(404).json({ error: "Poll not found" });

  const link = `${publicOrigin(req)}/vote/${poll.shareToken}`;
  const dataUrl = await QRCode.toDataURL(link, { width: 320, margin: 1 });
  res.json({ dataUrl, link });
});

router.get("/:pollId/export/option-wise", async (req, res) => {
  const poll = await loadOwnedPoll(req.params.pollId, req.teacher!.teacherId);
  if (!poll) return res.status(404).json({ error: "Poll not found" });
  const optionId = typeof req.query.optionId === "string" ? req.query.optionId : undefined;
  const selectedOption = optionId ? poll.options.find((option) => option.id === optionId) : undefined;
  if (optionId && !selectedOption) return res.status(400).json({ error: "Invalid poll option" });
  const [votes, students] = await Promise.all([
    prisma.vote.findMany({ where: { pollId: poll.id }, include: { selections: { include: { option: true } } } }),
    prisma.student.findMany({ where: { enrollments: { some: { classId: poll.classId } } }, select: { registerNumber: true, name: true, email: true } }),
  ]);
  const studentsByEmail = new Map(students.map((student) => [student.email, student]));
  const rows: string[][] = [["Option", "Register Number", "Student Name", "Email", "Voted At"]];
  for (const vote of votes) {
    const student = studentsByEmail.get(vote.voterEmail);
    for (const selection of vote.selections) {
      if (optionId && selection.optionId !== optionId) continue;
      rows.push([selection.option.text, student?.registerNumber || "", student?.name || "", vote.voterEmail, vote.createdAt.toISOString()]);
    }
  }
  res.setHeader("Content-Type", "text/csv");
  const suffix = selectedOption ? selectedOption.text : "option-wise";
  res.setHeader("Content-Disposition", `attachment; filename="${suffix.replace(/\s+/g, "_")}-voters.csv"`);
  res.send(stringify(rows));
});

router.get("/:pollId/export/class-roster", async (req, res) => {
  const poll = await loadOwnedPoll(req.params.pollId, req.teacher!.teacherId);
  if (!poll) return res.status(404).json({ error: "Poll not found" });

  const [enrollments, votes] = await Promise.all([
    prisma.classEnrollment.findMany({ where: { classId: poll.classId }, include: { student: true }, orderBy: { student: { registerNumber: "asc" } } }),
    prisma.vote.findMany({ where: { pollId: poll.id }, select: { voterEmail: true, createdAt: true } }),
  ]);
  const votesByEmail = new Map(votes.map((vote) => [vote.voterEmail, vote.createdAt.toISOString()]));
  const rows: string[][] = [["Register Number", "Student Name", "Email", "Poll Status", "Voted At"]];
  for (const enrollment of enrollments) {
    const votedAt = votesByEmail.get(enrollment.student.email);
    rows.push([enrollment.student.registerNumber, enrollment.student.name, enrollment.student.email, votedAt ? "POLLED" : "NOT POLLED", votedAt || ""]);
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${poll.topic.replace(/\s+/g, "_")}-class-roster.csv"`);
  res.send(stringify(rows));
});

// Export CSV: voted students, not-voted students, or filtered by topic across all polls.
router.get("/:pollId/export", async (req, res) => {
  const poll = await loadOwnedPoll(req.params.pollId, req.teacher!.teacherId);
  if (!poll) return res.status(404).json({ error: "Poll not found" });

  const type = (req.query.type as string) || "voted";
  const votes = await prisma.vote.findMany({
    where: { pollId: poll.id },
    include: { selections: { include: { option: true } } },
  });
  const votedEmails = new Set(votes.map((v) => v.voterEmail));

  let rows: string[][];
  let filename: string;

  if (type === "not-voted") {
    const notVoted = poll.authorizedEmails.filter((a) => !votedEmails.has(a.email));
    rows = [["Email"], ...notVoted.map((a) => [a.email])];
    filename = `${poll.topic}-not-voted.csv`;
  } else {
    rows = [
      ["Email", "Selected Option(s)", "Voted At"],
      ...votes.map((v) => [
        v.voterEmail,
        v.selections.map((s) => s.option.text).join(" | "),
        v.createdAt.toISOString(),
      ]),
    ];
    filename = `${poll.topic}-voted.csv`;
  }

  const csv = stringify(rows);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/\s+/g, "_")}"`);
  res.send(csv);
});

// Export across ALL of the teacher's polls for a given topic — "specific topic of polled list".
router.get("/export/by-topic", async (req, res) => {
  const topic = req.query.topic as string;
  if (!topic) return res.status(400).json({ error: "topic query param is required" });

  const polls = await prisma.poll.findMany({
    where: { teacherId: req.teacher!.teacherId, topic: { contains: topic } },
    include: { votes: true },
  });

  const rows: string[][] = [["Poll Title", "Topic", "Student Email", "Voted At"]];
  for (const poll of polls) {
    for (const v of poll.votes) {
      rows.push([poll.title, poll.topic, v.voterEmail, v.createdAt.toISOString()]);
    }
  }

  const csv = stringify(rows);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="topic-${topic.replace(/\s+/g, "_")}.csv"`);
  res.send(csv);
});

export default router;
