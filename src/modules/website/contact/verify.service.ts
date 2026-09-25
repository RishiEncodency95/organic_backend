import Otp from "../../../models/contact/otp.model";
import { env } from "../../../config/env";

export const sendPhoneOtpService = async (
  phone: string,
  profile: string = "CONTACT_ENQUIRY",
  name: string = "",
  eventName: string = "BOE2026"
) => {
  // Generate 6 digit numeric OTP
  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

  console.log(`📲 [WhatsApp OTP] Sent to ${phone}: ${generatedOtp}`);

  // Attempt sending WhatsApp OTP via Aisensy Gateway
  const aisensyKey = process.env.AISENSY_API_KEY || process.env.OPUS_API_KEY;
  const campaignName = process.env.AISENSY_CAMPAIGN_OTP || "otpAuthentication";

  // Track whether the gateway actually accepted the message. Previously the result was
  // only logged, so a rejected send still reported "OTP sent" back to the browser.
  let accepted = false;
  let gatewayError: string | null = null;

  if (!aisensyKey) {
    gatewayError = "WhatsApp gateway is not configured (AISENSY_API_KEY missing).";
  } else {
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

      console.log(`📡 [Aisensy WhatsApp API] Sending OTP to ${formattedPhone} with Campaign: ${campaignName}...`);

      // Meta's Authentication-category templates always carry a copy-code / autofill
      // button, and the same OTP must be repeated in that button's parameter. Sending
      // only templateParams gets accepted by AiSensy (it returns a submitted_message_id)
      // but Meta then drops the message, so nothing ever reaches WhatsApp.
      const payload = {
        apiKey: aisensyKey,
        campaignName: campaignName,
        destination: formattedPhone,
        userName: name || "User",
        templateParams: [generatedOtp],
        source: profile ? `website-${String(profile).toLowerCase()}` : "website",
        buttons: [
          {
            type: "button",
            sub_type: "url",
            index: 0,
            parameters: [{ type: "text", text: generatedOtp }],
          },
        ],
      };

      const res = await fetch("https://backend.aisensy.com/campaign/t1/api/v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
      });

      const respText = await res.text();
      console.log(`📲 [Aisensy API Response]: Status ${res.status} - ${respText}`);

      let parsed: any = null;
      try {
        parsed = JSON.parse(respText);
      } catch {
        // Non-JSON body — treated as a failure below.
      }

      // AiSensy reports success as the string "true".
      accepted = res.ok && String(parsed?.success) === "true";
      if (!accepted) {
        gatewayError =
          parsed?.errorMessage ||
          parsed?.message ||
          `WhatsApp gateway rejected the request (HTTP ${res.status}).`;
      }
    } catch (e: any) {
      gatewayError = e?.message || "Could not reach the WhatsApp gateway.";
      console.error("⚠️ [Aisensy WhatsApp API Exception]:", gatewayError);
    }
  }

  // Delete previous unverified OTPs for this phone
  await Otp.deleteMany({ phone, isVerified: false });

  // Create new OTP record
  const otpRecord = await Otp.create({
    phone,
    otp: generatedOtp,
    profile,
    name,
    eventName,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  // The OTP itself must never reach the browser in production — anyone could read it
  // from this response and verify as someone else. Kept only for local development.
  const isProduction = process.env.NODE_ENV === "production";

  if (!accepted) {
    return {
      success: false,
      message: gatewayError || "Could not send the WhatsApp OTP. Please try again.",
      msg: gatewayError || "Could not send the WhatsApp OTP. Please try again.",
      otpRecordId: otpRecord._id,
      ...(isProduction ? {} : { otp: generatedOtp }),
    };
  }

  return {
    success: true,
    message: "OTP sent successfully to your WhatsApp number.",
    msg: "OTP sent successfully to your WhatsApp number.",
    otpRecordId: otpRecord._id,
    ...(isProduction ? {} : { otp: generatedOtp }),
  };
};

export const verifyPhoneOtpService = async (phone: string, otp: string) => {
  // Master demo OTP fallback — development/testing only. Gated on NODE_ENV so it can
  // never be used to bypass phone verification on the live site.
  if (env.NODE_ENV !== "production" && (otp === "123456" || otp === "000000")) {
    return {
      success: true,
      message: "Phone number verified successfully.",
      msg: "Phone number verified successfully.",
    };
  }

  // Find valid unexpired OTP
  const record = await Otp.findOne({
    phone,
    otp,
    isVerified: false,
    expiresAt: { $gt: new Date() },
  });

  if (!record) {
    const hint = env.NODE_ENV !== "production" ? " (or use 123456 in dev)" : "";
    return {
      success: false,
      message: `Invalid or expired OTP. Please enter correct OTP${hint}.`,
      msg: `Invalid or expired OTP. Please enter correct OTP${hint}.`,
    };
  }

  // Mark as verified
  record.isVerified = true;
  await record.save();

  return {
    success: true,
    message: "Phone number verified successfully.",
    msg: "Phone number verified successfully.",
  };
};

export const sendEmailOtpService = async (
  email: string,
  profile: string = "SPEAKER",
  name: string = "",
  eventName: string = "BOE2026"
) => {
  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

  await Otp.deleteMany({ email, isVerified: false });

  const otpRecord = await Otp.create({
    email,
    otp: generatedOtp,
    profile,
    name,
    eventName,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  return {
    success: true,
    message: "OTP sent successfully to email.",
    msg: "OTP sent successfully to email.",
    otpRecordId: otpRecord._id,
  };
};

export const verifyEmailOtpService = async (email: string, otp: string) => {
  const record = await Otp.findOne({
    email,
    otp,
    isVerified: false,
    expiresAt: { $gt: new Date() },
  });

  if (!record) {
    return {
      success: false,
      message: "Invalid or expired OTP. Please try again.",
      msg: "Invalid or expired OTP. Please try again.",
    };
  }

  record.isVerified = true;
  await record.save();

  return {
    success: true,
    message: "Email address verified successfully.",
    msg: "Email address verified successfully.",
  };
};
