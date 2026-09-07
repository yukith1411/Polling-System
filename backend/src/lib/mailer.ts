import nodemailer from "nodemailer";

const EMAIL_MODE = process.env.EMAIL_MODE || "console";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

/**
 * Sends the OTP to a student's email.
 * In "console" mode (the default for local dev — no SMTP credentials needed),
 * the code is logged to the server terminal instead of actually emailed.
 * Switch EMAIL_MODE=smtp in .env once you have real SMTP credentials.
 */
export async function sendOtpEmail(email: string, code: string, pollTitle: string) {
  if (EMAIL_MODE === "console") {
    console.log(`\n[OTP EMAIL - console mode] To: ${email}`);
    console.log(`[OTP EMAIL] Poll: "${pollTitle}"`);
    console.log(`[OTP EMAIL] Your verification code is: ${code}`);
    console.log(`[OTP EMAIL] This code expires in ${process.env.OTP_TTL_MINUTES || 5} minutes.\n`);
    return;
  }

  const t = getTransporter();
  await t.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: `Your verification code for "${pollTitle}"`,
    text: `Your verification code is ${code}. It expires in ${process.env.OTP_TTL_MINUTES || 5} minutes.`,
    html: `<p>Your verification code is <b>${code}</b>.</p><p>It expires in ${process.env.OTP_TTL_MINUTES || 5} minutes.</p>`,
  });
}
