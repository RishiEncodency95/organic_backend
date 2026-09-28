import { ExternalService, IExternalService } from "./systemServices.model";
import { sendPhoneOtpService, verifyPhoneOtpService } from "../website/contact/verify.service";
import Otp from "../../models/contact/otp.model";

export const INITIAL_SEED_SERVICES = [
  {
    category: "DOMAIN",
    name: "Bharat Organic Domain (bharatorganicexpo.com)",
    provider: "GoDaddy Inc",
    accountIdentifier: "BOE-DOM-2027",
    loginUrl: "https://godaddy.com",
    startDate: new Date(Date.now() - 340 * 86400000).toISOString(),
    expiryDate: new Date(Date.now() + 18 * 86400000 + 4 * 3600000).toISOString(),
    autoRenews: true,
    remindersEnabled: true,
    pricingType: "PAID",
    costAmount: 2499,
    currency: "INR",
    billingCycle: "YEARLY",
    details: {
      domainName: "bharatorganicexpo.com",
      registrar: "GoDaddy",
      dnsProvider: "Cloudflare",
      nameservers: "ns1.cloudflare.com, ns2.cloudflare.com",
    },
  },
  {
    category: "HOSTING",
    name: "Production Server (Yashobhoomi Cloud)",
    provider: "Amazon Web Services (AWS)",
    accountIdentifier: "AWS-BOE-PROD",
    loginUrl: "https://aws.amazon.com",
    startDate: new Date(Date.now() - 300 * 86400000).toISOString(),
    expiryDate: new Date(Date.now() + 12 * 86400000 + 6 * 3600000).toISOString(),
    autoRenews: true,
    remindersEnabled: true,
    pricingType: "PAID",
    costAmount: 18500,
    currency: "INR",
    billingCycle: "MONTHLY",
    details: {
      serverType: "VPS / Dedicated",
      publicIp: "203.0.113.42",
      region: "ap-south-1 (Mumbai)",
      operatingSystem: "Ubuntu 24.04 LTS",
    },
  },
  {
    category: "SSL_CERTIFICATE",
    name: "Wildcard SSL Certificate (*.bharatorganicexpo.com)",
    provider: "Let's Encrypt",
    accountIdentifier: "SSL-BOE-WILD",
    loginUrl: "https://letsencrypt.org",
    startDate: new Date(Date.now() - 60 * 86400000).toISOString(),
    expiryDate: new Date(Date.now() + 45 * 86400000).toISOString(),
    autoRenews: true,
    remindersEnabled: true,
    pricingType: "FREE",
    details: {
      coveredDomains: "bharatorganicexpo.com, *.bharatorganicexpo.com",
      issuer: "Let's Encrypt Authority",
    },
  },
  {
    category: "PAYMENT_GATEWAY",
    name: "Razorpay Corporate Payment Gateway",
    provider: "Razorpay Software Pvt Ltd",
    accountIdentifier: "RZP-MID-EXPO2027",
    loginUrl: "https://dashboard.razorpay.com",
    startDate: new Date(Date.now() - 200 * 86400000).toISOString(),
    expiryDate: new Date(Date.now() + 120 * 86400000).toISOString(),
    autoRenews: true,
    remindersEnabled: true,
    pricingType: "PAID",
    costAmount: 0,
    currency: "INR",
    billingCycle: "ONE_TIME",
    details: {
      merchantId: "RZP_MID_EXPO2027",
      environment: "Live Production",
    },
  },
  {
    category: "SMS_WHATSAPP",
    name: "Meta WhatsApp Business API",
    provider: "AiSensy / Meta Cloud",
    accountIdentifier: "WABA-987654321",
    loginUrl: "https://aisensy.com",
    startDate: new Date(Date.now() - 150 * 86400000).toISOString(),
    expiryDate: new Date(Date.now() + 90 * 86400000).toISOString(),
    autoRenews: true,
    remindersEnabled: true,
    pricingType: "PAID",
    costAmount: 4500,
    currency: "INR",
    billingCycle: "MONTHLY",
    details: {
      phoneNumber: "+91 9310219283",
      wabaId: "WABA-987654321",
      phoneNumberId: "PNID-887766",
    },
  },
];

export async function seedSystemServicesIfEmpty() {
  const count = await ExternalService.countDocuments();
  if (count === 0) {
    console.log("🌱 [Seed] Seeding initial System & Security services data...");
    await ExternalService.insertMany(INITIAL_SEED_SERVICES);
    console.log("✅ [Seed] System & Security services seeded successfully.");
  }
}

export async function listSystemServices() {
  await seedSystemServicesIfEmpty();
  return ExternalService.find().sort({ expiryDate: 1 });
}

export async function getSystemServiceById(id: string) {
  return ExternalService.findById(id);
}

export async function createSystemService(payload: Partial<IExternalService>) {
  return ExternalService.create(payload);
}

export async function updateSystemService(id: string, payload: Partial<IExternalService>) {
  return ExternalService.findByIdAndUpdate(id, payload, { new: true });
}

export async function removeSystemService(id: string) {
  return ExternalService.findByIdAndDelete(id);
}

export async function getSystemServicesSummary() {
  await seedSystemServicesIfEmpty();
  return ExternalService.find().sort({ expiryDate: 1 });
}

export async function sendAccessWhatsAppOtp(phone: string, name?: string) {
  const targetPhone = phone && phone.trim() ? phone.trim() : "+91 9310219283";
  return sendPhoneOtpService(targetPhone, "SYSTEM_SECURITY_GATE", name || "Admin", "Bharat Organic Expo Admin");
}

export async function verifyAccessWhatsAppOtp(phone: string, otp: string) {
  const isProduction = process.env.NODE_ENV === "production";
  const cleanOtp = (otp || "").trim();

  // Allow dev master OTP codes (123456 / 000000)
  if (!isProduction && (cleanOtp === "123456" || cleanOtp === "000000")) {
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    return {
      success: true,
      message: "WhatsApp OTP verified successfully.",
      token: "grant-token-" + Date.now(),
      expiresAt,
      expiresInMinutes: 1440,
    };
  }

  // Look up OTP in DB matching code or phone
  const record = await Otp.findOne({
    otp: cleanOtp,
    isVerified: false,
    expiresAt: { $gt: new Date() },
  });

  if (!record) {
    const hint = !isProduction ? " (or use 123456 in dev)" : "";
    return {
      success: false,
      message: `Invalid or expired WhatsApp OTP. Please enter correct OTP${hint}.`,
      msg: `Invalid or expired WhatsApp OTP. Please enter correct OTP${hint}.`,
    };
  }

  record.isVerified = true;
  await record.save();

  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  return {
    success: true,
    message: "WhatsApp OTP verified successfully.",
    token: "grant-token-" + Date.now(),
    expiresAt,
    expiresInMinutes: 1440,
  };
}
