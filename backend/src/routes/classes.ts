import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireTeacherAuth } from "../middleware/auth";

const router = Router();
router.use(requireTeacherAuth);

// List this teacher's classes with student counts
router.get("/", async (req, res) => {
  const classes = await prisma.class.findMany({
    where: { teacherId: req.teacher!.teacherId },
    include: { _count: { select: { enrollments: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(classes.map((c) => ({ id: c.id, name: c.name, studentCount: c._count.enrollments, createdAt: c.createdAt })));
});

const createClassSchema = z.object({ name: z.string().min(1) });

router.post("/", async (req, res) => {
  const parsed = createClassSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const created = await prisma.class.create({
    data: { name: parsed.data.name, teacherId: req.teacher!.teacherId },
  });
  res.status(201).json(created);
});

// Get one class with its student roster
router.get("/:classId", async (req, res) => {
  const cls = await prisma.class.findFirst({
    where: { id: req.params.classId, teacherId: req.teacher!.teacherId },
    include: { enrollments: { include: { student: true } } },
  });
  if (!cls) return res.status(404).json({ error: "Class not found" });
  res.json({
    id: cls.id,
    name: cls.name,
    students: cls.enrollments.map((e) => ({ id: e.student.id, registerNumber: e.student.registerNumber, name: e.student.name, email: e.student.email })),
  });
});

const addStudentsSchema = z.object({
  students: z
    .array(z.object({ registerNumber: z.string().optional().default(""), name: z.string().min(1), email: z.string().email() }))
    .min(1),
});

// Bulk add/enroll students (creates the Student record if new, then enrolls in this class).
// This is how a teacher builds up the "registered students" directory.
router.post("/:classId/students", async (req, res) => {
  const cls = await prisma.class.findFirst({
    where: { id: req.params.classId, teacherId: req.teacher!.teacherId },
  });
  if (!cls) return res.status(404).json({ error: "Class not found" });

  const parsed = addStudentsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const results = [];
  for (const s of parsed.data.students) {
    const email = s.email.toLowerCase().trim();
    const student = await prisma.student.upsert({
      where: { email },
      update: { registerNumber: s.registerNumber?.trim() || "", name: s.name },
      create: { registerNumber: s.registerNumber?.trim() || "", name: s.name, email },
    });
    await prisma.classEnrollment.upsert({
      where: { classId_studentId: { classId: cls.id, studentId: student.id } },
      update: {},
      create: { classId: cls.id, studentId: student.id },
    });
    results.push(student);
  }
  res.status(201).json(results);
});

router.delete("/:classId/students/:studentId", async (req, res) => {
  const cls = await prisma.class.findFirst({
    where: { id: req.params.classId, teacherId: req.teacher!.teacherId },
  });
  if (!cls) return res.status(404).json({ error: "Class not found" });

  await prisma.classEnrollment.deleteMany({
    where: { classId: cls.id, studentId: req.params.studentId },
  });
  res.status(204).send();
});

export default router;
