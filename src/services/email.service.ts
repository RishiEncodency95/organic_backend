import nodemailer from "nodemailer";
import EmailLog from "../models/careers/EmailLog.model";

export interface SendApplicationEmailOptions {
  recipientEmail: string;
  candidateName: string;
  jobTitle: string;
  applicationId: string;
  matchScore: number;
  submittedAt: Date;
}

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

export const sendCandidateConfirmationEmail = async (
  options: SendApplicationEmailOptions
): Promise<boolean> => {
  const { recipientEmail, candidateName, jobTitle, applicationId, matchScore, submittedAt } = options;

  const subject = `Bharat Organic Expo – Application Received (${applicationId})`;
  const fromName = process.env.FROM_NAME || "Bharat Organic Expo Careers";
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
      .header { background: linear-gradient(135deg, #15803d 0%, #166534 100%); color: #ffffff; padding: 30px 20px; text-align: center; }
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
        <p>Application Confirmation</p>
      </div>
      <div class="content">
        <h2>Dear ${candidateName},</h2>
        <p>Thank you for applying for the position of <strong>${jobTitle}</strong> at Bharat Organic Expo 2027. We have successfully received your application!</p>
        
        <div class="card">
          <div class="detail-row">
            <span><strong>Application ID:</strong></span>
            <span class="badge">${applicationId}</span>
          </div>
          <div class="detail-row">
            <span><strong>Position:</strong></span>
            <span>${jobTitle}</span>
          </div>
          <div class="detail-row">
            <span><strong>Date Submitted:</strong></span>
            <span>${formattedDate}</span>
          </div>
          <div class="detail-row">
            <span><strong>AI Match Score:</strong></span>
            <span>${matchScore}%</span>
          </div>
          <div class="detail-row">
            <span><strong>Status:</strong></span>
            <span>SUBMITTED</span>
          </div>
        </div>

        <p>Our HR recruitment team is currently reviewing your profile and credentials. If your qualifications closely match our requirements, we will reach out to schedule an interview.</p>
        
        <p>Best regards,<br><strong>Talent Acquisition Team</strong><br>Bharat Organic Expo 2027</p>
      </div>
      <div class="footer">
        <p>&copy; 2027 Bharat Organic Expo. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>
  `;

  // Create Email Log
  const log = await EmailLog.create({
    recipient: recipientEmail,
    subject,
    template: "CANDIDATE_APPLICATION_CONFIRMATION",
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
    console.error("Failed to send candidate email:", err);
    log.status = "FAILED";
    log.error = (err as Error).message;
    await log.save();
    return false;
  }
};

export const sendAdminNotificationEmail = async (
  options: SendApplicationEmailOptions
): Promise<boolean> => {
  const adminEmail = process.env.CONTACT_ADMIN_EMAIL || process.env.SMTP_USER;
  if (!adminEmail) return false;

  const { recipientEmail, candidateName, jobTitle, applicationId, matchScore } = options;
  const subject = `New Job Application Received: ${applicationId} - ${candidateName}`;

  const html = `
  <h3>New Candidate Application</h3>
  <p><strong>Application ID:</strong> ${applicationId}</p>
  <p><strong>Candidate Name:</strong> ${candidateName}</p>
  <p><strong>Candidate Email:</strong> ${recipientEmail}</p>
  <p><strong>Applied Position:</strong> ${jobTitle}</p>
  <p><strong>Match Score:</strong> ${matchScore}%</p>
  <p>Log into the admin portal to review full CV analysis and profile snapshot.</p>
  `;

  const transporter = getTransporter();
  if (!transporter) return false;

  try {
    await transporter.sendMail({
      from: `"${process.env.FROM_NAME || 'Bharat Organic Careers'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to: adminEmail,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error("Admin notification email error:", err);
    return false;
  }
};
