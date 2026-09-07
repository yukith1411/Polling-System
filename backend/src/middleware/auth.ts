import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;

export interface TeacherTokenPayload {
  teacherId: string;
  email: string;
  role: string;
}

export interface StudentSessionPayload {
  pollId: string;
  email: string;
  purpose: "poll-session";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      teacher?: TeacherTokenPayload;
      studentSession?: StudentSessionPayload;
    }
  }
}

export function signTeacherToken(payload: TeacherTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "12h",
  } as jwt.SignOptions);
}

export function requireTeacherAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TeacherTokenPayload;
    req.teacher = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.teacher?.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// Short-lived token issued only after a student successfully verifies their OTP.
// This is what proves "this request came from someone who passed authorization + OTP",
// so the poll-fetch and vote endpoints never trust a bare email from the client.
export function signStudentSessionToken(payload: Omit<StudentSessionPayload, "purpose">): string {
  return jwt.sign({ ...payload, purpose: "poll-session" }, JWT_SECRET, { expiresIn: "30m" });
}

export function requireStudentSession(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing student session. Sign in first." });
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as StudentSessionPayload;
    if (payload.purpose !== "poll-session") throw new Error("wrong token type");
    req.studentSession = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired student session. Sign in again." });
  }
}
