import { getTransporter } from "./email.service";

export interface OtpMailResult {
  sent: boolean;
  /** Why delivery failed, phrased for the browser. Null on success. */
  error: string | null;
}

const OTP_VALIDITY_MINUTES = 10;

const buildOtpHtml = (otp: string, name: string, eventName: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px; }
    .container { max-width: 520px; background: #ffffff; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #15803d 0%, #166534 100%); color: #ffffff; padding: 28px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
    .header p { margin: 6px 0 0 0; opacity: 0.9; font-size: 13px; }
    .content { padding: 30px; color: #334155; line-height: 1.6; }
    .code { font-size: 34px; font-weight: 700; letter-spacing: 10px; color: #15803d; text-align: center; padding: 18px 0; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; margin: 22px 0; }
    .muted { font-size: 12px; color: #64748b; }
    .footer { background: #f8fafc; padding: 16px 20px; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Verify your email</h1>
      <p>${eventName}</p>
    </div>
    <div class="content">
      <p>Hello${name ? ` ${name}` : ""},</p>
      <p>Use the verification code below to confirm your email address and continue with your application.</p>
      <div class="code">${otp}</div>
      <p class="muted">This code expires in ${OTP_VALIDITY_MINUTES} minutes and can be used once. If you did not request it, you can safely ignore this email — nobody can proceed without it.</p>
    </div>
    <div class="footer">Bharat Organic Expo · This is an automated message, please do not reply.</div>
  </div>
</body>
</html>`;

/**
 * Delivers a 6-digit verification code. Returns why delivery failed rather than a bare
 * false, so the caller can tell the browser something truer than "OTP sent" when the
 * message never left the server.
 */
export const sendOtpEmail = async (
  recipientEmail: string,
  otp: string,
  name: string = "",
  eventName: string = "Bharat Organic Expo 2026"
): Promise<OtpMailResult> => {
  const transporter = getTransporter();
  if (!transporter) {
    return { sent: false, error: "Email service is not configured on the server (SMTP credentials missing)." };
  }

  const fromName = process.env.FROM_NAME || "Bharat Organic Expo";
  const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER;

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: recipientEmail,
      subject: `${otp} is your Bharat Organic Expo verification code`,
      html: buildOtpHtml(otp, name, eventName),
      // Plain-text alternative keeps the code readable in clients that block HTML,
      // and materially improves the odds of landing in the inbox over spam.
      text: `Your ${eventName} verification code is ${otp}. It expires in ${OTP_VALIDITY_MINUTES} minutes.`,
    });

    // A resolved sendMail only means the relay took the message — it can still have
    // rejected this particular recipient. Without logging what the server actually
    // said, "OTP not arriving" is unanswerable from the logs alone.
    console.log(
      `📧 [Email OTP] to=${recipientEmail} accepted=${JSON.stringify(info.accepted)} ` +
        `rejected=${JSON.stringify(info.rejected)} id=${info.messageId} response=${info.response}`
    );

    if (!info.accepted?.length) {
      return { sent: false, error: "The mail server rejected this address. Please check it and try again." };
    }
    return { sent: true, error: null };
  } catch (err) {
    console.error("❌ [Email OTP] Send failed:", (err as Error).message);
    return { sent: false, error: "Could not send the verification email. Please check the address and try again." };
  }
};
