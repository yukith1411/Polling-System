import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);
  const adminPasswordHash = await bcrypt.hash("Admin@123", 10);
  const teacher = await prisma.teacher.upsert({
    where: { email: "teacher@example.com" },
    update: {},
    create: { name: "Ms. Sharma", email: "teacher@example.com", passwordHash },
  });

  const existingAdmin = await prisma.teacher.findFirst({ where: { role: "ADMIN" } });
  if (existingAdmin && existingAdmin.email !== "admin@gmail.com") {
    await prisma.teacher.update({
      where: { id: existingAdmin.id },
      data: { email: "admin@gmail.com", passwordHash: adminPasswordHash, role: "ADMIN" },
    });
  } else {
    await prisma.teacher.upsert({
      where: { email: "admin@gmail.com" },
      update: { passwordHash: adminPasswordHash, role: "ADMIN" },
      create: { name: "System Admin", email: "admin@gmail.com", passwordHash: adminPasswordHash, role: "ADMIN" },
    });
  }

  const cls = await prisma.class.create({
    data: { name: "Grade 10 - Section A", teacherId: teacher.id },
  });

  const studentDefs = [
    { name: "Aisha Khan", email: "aisha@example.com" },
    { name: "Rahul Verma", email: "rahul@example.com" },
    { name: "Priya Nair", email: "priya@example.com" },
  ];

  const students = [];
  for (const s of studentDefs) {
    const student = await prisma.student.upsert({
      where: { email: s.email },
      update: {},
      create: s,
    });
    await prisma.classEnrollment.create({ data: { classId: cls.id, studentId: student.id } });
    students.push(student);
  }

  await prisma.poll.create({
    data: {
      title: "Which topic should we review next?",
      topic: "Weekly Check-in",
      description: "Pick the topic you'd like the most help with.",
      classId: cls.id,
      teacherId: teacher.id,
      shareToken: crypto.randomBytes(16).toString("hex"),
      status: "OPEN",
      options: { create: [{ text: "Algebra", order: 0 }, { text: "Geometry", order: 1 }, { text: "Statistics", order: 2 }] },
      authorizedEmails: { create: students.map((s) => ({ email: s.email })) },
    },
  });

  console.log("Seeded: admin login = admin@gmail.com / Admin@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
