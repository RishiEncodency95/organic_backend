import BuyerEnquiry from "../../../models/contact/buyerEnquiry.model";
import Otp from "../../../models/contact/otp.model";
import { env } from "../../../config/env";
import { ApiError } from "../../../utils/ApiError";

export const BUYER_ENQUIRY_OTP_PROFILE = "BUYER_ENQUIRY";
export const BUYER_ENQUIRY_STATUSES = ["pending", "contacted", "resolved"] as const;

const text = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);

/**
 * The popup only submits after the browser verified the WhatsApp OTP, but that check is
 * client-side. Here the server confirms a verified OTP record for this number exists (and
 * consumes it so it can't be replayed). Outside production the dev master OTP (123456)
 * verifies without creating a record, so the check is skipped there.
 */
const consumeVerifiedPhone = async (phone: string) => {
  const record = await Otp.findOneAndDelete({
    phone: { $in: [phone, `91${phone}`, `+91${phone}`] },
    isVerified: true,
    profile: BUYER_ENQUIRY_OTP_PROFILE,
  });
  if (!record && env.NODE_ENV === "production") {
    throw ApiError.badRequest("Please verify your WhatsApp number with OTP before submitting.");
  }
};

export const createBuyerEnquiryService = async (payload: any) => {
  const name = text(payload?.name, 120);
  const phone = text(payload?.phone).replace(/\D/g, "").slice(-10);
  const email = text(payload?.email, 200).toLowerCase();
  const enquiryAbout = text(payload?.enquiryAbout, 120);
  const message = text(payload?.message, 2000);

  if (!name || !email || !enquiryAbout || !message) {
    throw ApiError.badRequest("Full name, email, enquiry topic and message are required.");
  }
  if (!/^[6-9]\d{9}$/.test(phone)) {
    throw ApiError.badRequest("Enter a valid 10-digit WhatsApp number.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw ApiError.badRequest("Enter a valid email address.");
  }
  if (payload?.consent !== true) {
    throw ApiError.badRequest("Please agree to be contacted regarding your enquiry.");
  }

  await consumeVerifiedPhone(phone);

  return BuyerEnquiry.create({
    name,
    company: text(payload?.company, 200),
    phone,
    email,
    city: text(payload?.city, 120),
    country: text(payload?.country, 120),
    buyerType: text(payload?.buyerType, 120),
    enquiryAbout,
    message,
  });
};

export const listBuyerEnquiriesService = async (query: any = {}) => {
  const limit = Math.min(parseInt(query?.limit, 10) || 1000, 2000);
  const filter: Record<string, unknown> = {};
  if (BUYER_ENQUIRY_STATUSES.includes(query?.status)) filter.status = query.status;
  const [enquiries, total] = await Promise.all([
    BuyerEnquiry.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
    BuyerEnquiry.countDocuments(filter),
  ]);
  return { enquiries, total };
};

export const updateBuyerEnquiryStatusService = async (id: string, status: unknown) => {
  if (!BUYER_ENQUIRY_STATUSES.includes(status as any)) {
    throw ApiError.badRequest(`Status must be one of: ${BUYER_ENQUIRY_STATUSES.join(", ")}`);
  }
  const enquiry = await BuyerEnquiry.findByIdAndUpdate(id, { status }, { new: true, runValidators: true });
  if (!enquiry) throw ApiError.notFound("Buyer enquiry not found.");
  return enquiry;
};

export const deleteBuyerEnquiryService = async (id: string) => {
  const enquiry = await BuyerEnquiry.findByIdAndDelete(id);
  if (!enquiry) throw ApiError.notFound("Buyer enquiry not found.");
  return enquiry;
};
