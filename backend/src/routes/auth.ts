import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireTeacherAuth, signTeacherToken } from "../middleware/auth";

const router = Router();

const signupSchema = z.object({
  name: z.string().min(1),
  department: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { name, department, email, password } = parsed.data;

  const existing = await prisma.teacher.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "An account with this email already exists." });

  const passwordHash = await bcrypt.hash(password, 10);
  const teacher = await prisma.teacher.create({ data: { name, department, email, passwordHash } });

  const token = signTeacherToken({ teacherId: teacher.id, email: teacher.email, role: teacher.role });
  res.status(201).json({ token, teacher: { id: teacher.id, name: teacher.name, department: teacher.department, email: teacher.email, role: teacher.role } });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password } = parsed.data;

  const teacher = await prisma.teacher.findUnique({ where: { email } });
  if (!teacher) return res.status(401).json({ error: "Invalid email or password." });

  const ok = await bcrypt.compare(password, teacher.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid email or password." });

  const token = signTeacherToken({ teacherId: teacher.id, email: teacher.email, role: teacher.role });
  res.json({ token, teacher: { id: teacher.id, name: teacher.name, department: teacher.department, email: teacher.email, role: teacher.role } });
});

const profileSchema = z.object({ name: z.string().min(1), department: z.string().min(1) });

router.patch("/me", requireTeacherAuth, async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const teacher = await prisma.teacher.update({ where: { id: req.teacher!.teacherId }, data: parsed.data });
  const token = signTeacherToken({ teacherId: teacher.id, email: teacher.email, role: teacher.role });
  res.json({ token, teacher: { id: teacher.id, name: teacher.name, department: teacher.department, email: teacher.email, role: teacher.role } });
});

export default router;
