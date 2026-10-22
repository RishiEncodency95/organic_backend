import nodemailer from "nodemailer";
import EmailLog from "../models/careers/EmailLog.model";

export const getTransporter = () => {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn("⚠️ SMTP credentials not fully configured.");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

export interface SendHrForwardEmailOptions {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  html: string;
  text?: string;
  // `cid` marks an image shown inside the email (the logo) rather than a downloadable file.
  attachments?: { filename: string; content: Buffer; cid?: string; contentType?: string }[];
}

// "Forward to HR" from admin Applications & AI Response; recipients come from
// Career Settings → HR & Workflow with their To / CC / BCC choice.
export const sendHrForwardEmail = async (options: SendHrForwardEmailOptions): Promise<{ sent: boolean; error?: string }> => {
  const { to, cc, bcc, subject, html, text, attachments } = options;
  if (to.length === 0) return { sent: false, error: "No To recipient" };

  const log = await EmailLog.create({
    recipient: [...to, ...cc.map((e) => `cc:${e}`), ...bcc.map((e) => `bcc:${e}`)].join(", "),
    subject,
    template: "HR_FORWARD_APPLICATION",
    status: "QUEUED",
  });

  const transporter = getTransporter();
  if (!transporter) {
    log.status = "FAILED";
    log.error = "SMTP credentials not configured";
    await log.save();
    return { sent: false, error: "SMTP credentials not configured" };
  }

  const fromName = process.env.FROM_NAME || "Bharat Organic Expo Careers";
  const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || "noreply@bharatorganicexpo.com";
  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      cc: cc.length ? cc : undefined,
      bcc: bcc.length ? bcc : undefined,
      subject,
      html,
      text,
      attachments,
    });
    log.status = "SENT";
    log.sentAt = new Date();
    await log.save();
    return { sent: true };
  } catch (err) {
    console.error("HR forward email error:", err);
    log.status = "FAILED";
    log.error = (err as Error).message;
    await log.save();
    return { sent: false, error: (err as Error).message };
  }
};
