import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAdmin, requireTeacherAuth } from "../middleware/auth";

const router = Router();
router.use(requireTeacherAuth, requireAdmin);

const teacherUpdateSchema = z.object({ name: z.string().min(1), department: z.string().min(1), role: z.enum(["TEACHER", "ADMIN"]) });

router.patch("/teachers/:teacherId", async (req, res) => {
  if (req.params.teacherId === req.teacher!.teacherId && req.body.role !== "ADMIN") {
    return res.status(400).json({ error: "You cannot remove your own admin access." });
  }
  const parsed = teacherUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const teacher = await prisma.teacher.update({ where: { id: req.params.teacherId }, data: parsed.data, select: { id: true, name: true, department: true, email: true, role: true, createdAt: true } });
  res.json(teacher);
});

router.get("/overview", async (_req, res) => {
  const [teachers, classes, students, polls, votes, accessAttempts, statusGroups] = await Promise.all([
    prisma.teacher.findMany({ select: { id: true, name: true, department: true, email: true, role: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    prisma.class.findMany({ include: { teacher: { select: { name: true, email: true } }, _count: { select: { enrollments: true, polls: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.student.count(),
    prisma.poll.findMany({ include: { teacher: { select: { name: true, email: true } }, class: { select: { name: true } }, _count: { select: { votes: true, authorizedEmails: true, accessAttempts: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.vote.count(),
    prisma.accessAttempt.count(),
    prisma.poll.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  res.json({
    counts: { teachers: teachers.length, classes: classes.length, students, polls: polls.length, votes, accessAttempts },
    pollStatuses: Object.fromEntries(statusGroups.map((group) => [group.status, group._count._all])),
    teachers,
    classes,
    polls: polls.map((poll) => ({ ...poll, createdAt: poll.createdAt.toISOString(), updatedAt: poll.updatedAt.toISOString() })),
  });
});

export default router;