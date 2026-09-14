import Otp from "../../../models/contact/otp.model";

export const sendPhoneOtpService = async (
  phone: string,
  profile: string = "CONTACT_ENQUIRY",
  name: string = "",
  eventName: string = "BOE2026"
) => {
  // Generate 6 digit numeric OTP
  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

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

  return {
    success: true,
    message: "OTP sent successfully to WhatsApp.",
    msg: "OTP sent successfully to WhatsApp.",
    otpRecordId: otpRecord._id,
  };
};

export const verifyPhoneOtpService = async (phone: string, otp: string) => {
  // Find valid unexpired OTP
  const record = await Otp.findOne({
    phone,
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
