import EmailLog from "../models/careers/EmailLog.model";
import { getTransporter } from "./email.service";

export interface SendMsmeEmailOptions {
  recipientEmail: string;
  enterpriseName: string;
  applicationId: string;
  stallType?: string;
  stallSize?: string;
  amount?: number;
  submittedAt: Date;
}

const formatAmount = (amount?: number) => (amount ? `₹${amount.toLocaleString("en-IN")}` : "—");

export const sendMsmeCandidateConfirmationEmail = async (options: SendMsmeEmailOptions): Promise<boolean> => {
  const { recipientEmail, enterpriseName, applicationId, stallType, stallSize, amount, submittedAt } = options;

  const subject = `Bharat Organic Expo – PMS Application Received (${applicationId})`;
  const fromName = process.env.FROM_NAME || "Bharat Organic Expo";
  const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || "noreply@bharatorganicexpo.com";

  const formattedDate = new Date(submittedAt).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px; }
      .container { max-width: 600px; background: #ffffff; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
      .header { background: linear-gradient(135deg, #176b27 0%, #0f4a1a 100%); color: #ffffff; padding: 30px 20px; text-align: center; }
      .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
      .header p { margin: 5px 0 0 0; opacity: 0.9; font-size: 14px; }
      .content { padding: 30px; color: #334155; line-height: 1.6; }
      .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
      .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; }
      .detail-row:last-child { border-bottom: none; }
      .badge { background: #dcfce7; color: #166534; font-weight: 600; padding: 4px 12px; border-radius: 20px; font-size: 14px; }
      .footer { background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Bharat Organic Expo 2027</h1>
        <p>PMS Support Application Confirmation</p>
      </div>
      <div class="content">
        <h2>Dear ${enterpriseName},</h2>
        <p>Thank you for applying for PMS (Participation & Marketing Support) at Bharat Organic Expo 2027. We have successfully received your application and payment.</p>

        <div class="card">
          <div class="detail-row">
            <span><strong>Application ID:</strong></span>
            <span class="badge">${applicationId}</span>
          </div>
          <div class="detail-row">
            <span><strong>Stall Type:</strong></span>
            <span>${stallType || "—"}</span>
          </div>
          <div class="detail-row">
            <span><strong>Stall Size:</strong></span>
            <span>${stallSize ? `${stallSize} sqm` : "—"}</span>
          </div>
          <div class="detail-row">
            <span><strong>Amount Paid:</strong></span>
            <span>${formatAmount(amount)}</span>
          </div>
          <div class="detail-row">
            <span><strong>Date Submitted:</strong></span>
            <span>${formattedDate}</span>
          </div>
          <div class="detail-row">
            <span><strong>Status:</strong></span>
            <span>SUBMITTED</span>
          </div>
        </div>

        <p>Our PMS support team is currently reviewing your application. PMS assistance eligibility and the assisted amount (if approved) will be assessed by the Ministry of MSME as per scheme guidelines after the event.</p>

        <p>Best regards,<br><strong>PMS Support Team</strong><br>Bharat Organic Expo 2027</p>
      </div>
      <div class="footer">
        <p>&copy; 2027 Bharat Organic Expo. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>
  `;

  const log = await EmailLog.create({
    recipient: recipientEmail,
    subject,
    template: "MSME_APPLICATION_CONFIRMATION",
    status: "QUEUED",
  });

  const transporter = getTransporter();
  if (!transporter) {
    console.warn(`[EMAIL SKIPPED] No SMTP credentials. Email log ID: ${log._id}`);
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: recipientEmail,
      subject,
      html,
    });

    log.status = "SENT";
    log.sentAt = new Date();
    await log.save();
    return true;
  } catch (err) {
    console.error("Failed to send MSME candidate email:", err);
    log.status = "FAILED";
    log.error = (err as Error).message;
    await log.save();
    return false;
  }
};

export const sendMsmeAdminNotificationEmail = async (options: SendMsmeEmailOptions): Promise<boolean> => {
  const adminEmail = process.env.CONTACT_ADMIN_EMAIL || process.env.SMTP_USER;
  if (!adminEmail) return false;

  const { recipientEmail, enterpriseName, applicationId, stallType, stallSize, amount } = options;
  const subject = `New MSME PMS Application: ${applicationId} - ${enterpriseName}`;

  const html = `
  <h3>New MSME PMS Application</h3>
  <p><strong>Application ID:</strong> ${applicationId}</p>
  <p><strong>Enterprise Name:</strong> ${enterpriseName}</p>
  <p><strong>Enterprise Email:</strong> ${recipientEmail}</p>
  <p><strong>Stall Type:</strong> ${stallType || "—"}</p>
  <p><strong>Stall Size:</strong> ${stallSize ? `${stallSize} sqm` : "—"}</p>
  <p><strong>Amount Paid:</strong> ${formatAmount(amount)}</p>
  <p>Log into the admin portal (MSME Applications) to review the full submission.</p>
  `;

  const transporter = getTransporter();
  if (!transporter) return false;

  try {
    await transporter.sendMail({
      from: `"${process.env.FROM_NAME || "Bharat Organic Expo"}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to: adminEmail,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error("MSME admin notification email error:", err);
    return false;
  }
};
