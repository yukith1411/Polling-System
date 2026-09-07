import crypto from "crypto";
import bcrypt from "bcryptjs";

const OTP_LENGTH = Number(process.env.OTP_LENGTH || 6);

export function generateOtp(): string {
  // Cryptographically random numeric code, zero-padded to OTP_LENGTH digits.
  const max = 10 ** OTP_LENGTH;
  const n = crypto.randomInt(0, max);
  return n.toString().padStart(OTP_LENGTH, "0");
}

export async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export async function verifyOtpHash(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

export function otpExpiryDate(): Date {
  const minutes = Number(process.env.OTP_TTL_MINUTES || 5);
  return new Date(Date.now() + minutes * 60 * 1000);
}

export function generateShareToken(): string {
  return crypto.randomBytes(16).toString("hex");
}
