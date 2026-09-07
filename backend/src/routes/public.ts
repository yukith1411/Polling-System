import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma";
import { generateOtp, hashOtp, verifyOtpHash, otpExpiryDate } from "../lib/otp";
import { sendOtpEmail } from "../lib/mailer";
import { requireStudentSession, signStudentSessionToken } from "../middleware/auth";
import { computePollResults } from "../lib/results";
import { getIo, pollRoom } from "../lib/socket";

const router = Router();

const otpRequestLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });
const otpVerifyLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const studentLoginLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

async function findPollByToken(shareToken: string) {
  return prisma.poll.findUnique({
    where: { shareToken },
    include: { authorizedEmails: true, options: { orderBy: { order: "asc" } }, class: true, teacher: true },
  });
}

// Minimal, non-sensitive info shown before any authorization — no options/questions here.
router.get("/:shareToken", async (req, res) => {
  const poll = await findPollByToken(req.params.shareToken);
  if (!poll) return res.status(404).json({ error: "This poll link is invalid." });
  res.json({
    title: poll.title,
    topic: poll.topic,
    teacherName: poll.teacher.name,
    className: poll.class.name,
    status: poll.status,
  });
});

const emailSchema = z.object({ email: z.string().email() });
const studentLoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post("/:shareToken/student-login", studentLoginLimiter, async (req, res) => {
  const poll = await findPollByToken(req.params.shareToken);
  if (!poll) return res.status(404).json({ error: "This poll link is invalid." });

  const parsed = studentLoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Registered email and password are required." });
  const email = parsed.data.email.toLowerCase().trim();
  const isAuthorized = poll.authorizedEmails.some((authorized) => authorized.email === email);
  if (!isAuthorized) {
    await prisma.accessAttempt.create({ data: { pollId: poll.id, email, authorized: false, reason: "not_authorized" } });
    return res.status(403).json({ error: "This email is not authorized to access this poll." });
  }
  if (parsed.data.password !== (process.env.STUDENT_COMMON_PASSWORD || "kit@123")) {
    await prisma.accessAttempt.create({ data: { pollId: poll.id, email, authorized: true, reason: "invalid_password" } });
    return res.status(401).json({ error: "Invalid student password." });
  }
  if (poll.status === "CLOSED") return res.status(410).json({ error: "This poll has closed." });
  const sessionToken = signStudentSessionToken({ pollId: poll.id, email });
  await prisma.accessAttempt.create({ data: { pollId: poll.id, email, authorized: true, reason: "student_login" } });
  res.json({ sessionToken });
});

// Step 1: student enters email. We check authorization server-side and, ONLY if authorized,
// send an OTP. Unauthorized attempts get a generic response and never see poll content.
router.post("/:shareToken/request-otp", otpRequestLimiter, async (req, res) => {
  const poll = await findPollByToken(req.params.shareToken);
  if (!poll) return res.status(404).json({ error: "This poll link is invalid." });

  const parsed = emailSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A valid email is required." });
  const email = parsed.data.email.toLowerCase().trim();

  const isAuthorized = poll.authorizedEmails.some((a) => a.email === email);

  if (!isAuthorized) {
    await prisma.accessAttempt.create({
      data: { pollId: poll.id, email, authorized: false, reason: "not_authorized" },
    });
    // Deliberately generic — does not confirm/deny whether the email exists elsewhere,
    // and never reveals poll questions/options.
    return res.status(403).json({ error: "This email is not authorized to access this poll." });
  }

  if (poll.status === "CLOSED") {
    return res.status(410).json({ error: "This poll has closed." });
  }

  const alreadyVoted = await prisma.vote.findUnique({
    where: { pollId_voterEmail: { pollId: poll.id, voterEmail: email } },
  });
  if (alreadyVoted) {
    await prisma.accessAttempt.create({
      data: { pollId: poll.id, email, authorized: true, reason: "already_voted" },
    });
    return res.status(409).json({ error: "You have already voted in this poll." });
  }

  const code = generateOtp();
  const codeHash = await hashOtp(code);
  await prisma.otpCode.create({
    data: { pollId: poll.id, email, codeHash, expiresAt: otpExpiryDate() },
  });
  await sendOtpEmail(email, code, poll.title);

  await prisma.accessAttempt.create({ data: { pollId: poll.id, email, authorized: true, reason: "otp_sent" } });

  res.json({ message: "A verification code has been sent to your email." });
});

const verifySchema = z.object({ email: z.string().email(), code: z.string().min(4) });

// Step 2: verify the OTP and issue a short-lived session token used for fetching the
// poll questions and submitting the vote. The poll's questions are never sent before this.
router.post("/:shareToken/verify-otp", otpVerifyLimiter, async (req, res) => {
  const poll = await findPollByToken(req.params.shareToken);
  if (!poll) return res.status(404).json({ error: "This poll link is invalid." });

  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Email and code are required." });
  const email = parsed.data.email.toLowerCase().trim();

  const isAuthorized = poll.authorizedEmails.some((a) => a.email === email);
  if (!isAuthorized) {
    return res.status(403).json({ error: "This email is not authorized to access this poll." });
  }

  const otp = await prisma.otpCode.findFirst({
    where: { pollId: poll.id, email, consumed: false },
    orderBy: { createdAt: "desc" },
  });

  if (!otp || otp.expiresAt < new Date()) {
    return res.status(400).json({ error: "Code expired or not found. Please request a new one." });
  }

  const maxAttempts = Number(process.env.OTP_MAX_ATTEMPTS || 5);
  if (otp.attempts >= maxAttempts) {
    return res.status(429).json({ error: "Too many incorrect attempts. Please request a new code." });
  }

  const valid = await verifyOtpHash(parsed.data.code, otp.codeHash);
  if (!valid) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return res.status(400).json({ error: "Incorrect code." });
  }

  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });

  const sessionToken = signStudentSessionToken({ pollId: poll.id, email });
  res.json({ sessionToken });
});

// Step 3: fetch the actual poll questions — only reachable with a valid post-OTP session token.
router.get("/:shareToken/content", requireStudentSession, async (req, res) => {
  const poll = await findPollByToken(req.params.shareToken);
  if (!poll) return res.status(404).json({ error: "This poll link is invalid." });
  if (req.studentSession!.pollId !== poll.id) {
    return res.status(403).json({ error: "Session does not match this poll." });
  }

  const existingVote = await prisma.vote.findUnique({
    where: { pollId_voterEmail: { pollId: poll.id, voterEmail: req.studentSession!.email } },
    include: { selections: true },
  });

  res.json({
    id: poll.id,
    title: poll.title,
    topic: poll.topic,
    description: poll.description,
    status: poll.status,
    allowMultipleAnswer: poll.allowMultipleAnswer,
    allowVoteChange: poll.allowVoteChange,
    options: poll.options.map((o) => ({ id: o.id, text: o.text })),
    alreadyVoted: !!existingVote,
    yourSelections: existingVote?.selections.map((s) => s.optionId) ?? [],
  });
});

const voteSchema = z.object({ optionIds: z.array(z.string().min(1)).min(1) });

// Step 4: submit the vote. DB unique constraint (pollId, voterEmail) is the final backstop
// against double-voting even under concurrent requests.
router.post("/:shareToken/vote", requireStudentSession, async (req, res) => {
  const poll = await findPollByToken(req.params.shareToken);
  if (!poll) return res.status(404).json({ error: "This poll link is invalid." });
  if (req.studentSession!.pollId !== poll.id) {
    return res.status(403).json({ error: "Session does not match this poll." });
  }
  const email = req.studentSession!.email;

  if (poll.status !== "OPEN") {
    await prisma.accessAttempt.create({
      data: { pollId: poll.id, email, authorized: true, reason: `poll_${poll.status.toLowerCase()}` },
    });
    return res.status(423).json({ error: `Voting is not currently open (poll is ${poll.status}).` });
  }

  const parsed = voteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Select at least one option." });

  if (!poll.allowMultipleAnswer && parsed.data.optionIds.length > 1) {
    return res.status(400).json({ error: "This poll only allows a single selection." });
  }

  const validOptionIds = new Set(poll.options.map((o) => o.id));
  if (!parsed.data.optionIds.every((id) => validOptionIds.has(id))) {
    return res.status(400).json({ error: "One or more selected options are invalid." });
  }

  try {
    const existingVote = await prisma.vote.findUnique({ where: { pollId_voterEmail: { pollId: poll.id, voterEmail: email } } });
    if (existingVote && !poll.allowVoteChange) return res.status(409).json({ error: "You have already voted in this poll." });
    if (existingVote) {
      await prisma.$transaction([
        prisma.voteOption.deleteMany({ where: { voteId: existingVote.id } }),
        prisma.voteOption.createMany({ data: parsed.data.optionIds.map((optionId) => ({ voteId: existingVote.id, optionId })) }),
      ]);
    } else {
      await prisma.vote.create({
        data: {
          pollId: poll.id,
          voterEmail: email,
          selections: { create: parsed.data.optionIds.map((optionId) => ({ optionId })) },
        },
      });
    }
  } catch (err: any) {
    // Unique constraint violation on (pollId, voterEmail) → duplicate vote attempt.
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "You have already voted in this poll." });
    }
    throw err;
  }

  const results = await computePollResults(poll.id);
  getIo().to(pollRoom(poll.id)).emit("poll:results", results);

  res.status(201).json({ message: "Vote recorded." });
});

export default router;
