import PartnershipEnquiry from "../../../models/contact/partnershipEnquiry.model";
import Otp from "../../../models/contact/otp.model";
import { env } from "../../../config/env";
import { ApiError } from "../../../utils/ApiError";

export const PARTNERSHIP_OTP_PROFILE = "PARTNERSHIP_ENQUIRY";

/**
 * The form only submits after the browser verified the WhatsApp OTP, but that check is
 * client-side. Here the server confirms a verified OTP record for this number actually
 * exists (and consumes it so it can't be replayed). Outside production the dev master OTP
 * (123456) verifies without creating a record, so the check is skipped there.
 */
const consumeVerifiedPhone = async (phone: string) => {
  const record = await Otp.findOneAndDelete({ phone, isVerified: true, profile: PARTNERSHIP_OTP_PROFILE });
  if (!record && env.NODE_ENV === "production") {
    throw ApiError.badRequest("Please verify your WhatsApp number with OTP before submitting.");
  }
};

export const createPartnershipEnquiryService = async (payload: any) => {
  const name = String(payload?.name || "").trim();
  const organization = String(payload?.organization || "").trim();
  const email = String(payload?.email || "").trim();
  const phone = String(payload?.phone || "").trim();
  const category = String(payload?.category || "").trim();

  if (!name || !organization || !email || !phone || !category) {
    throw ApiError.badRequest("Full name, organization, email, mobile number and partnership category are required.");
  }

  await consumeVerifiedPhone(phone);

  return await PartnershipEnquiry.create({
    name,
    organization,
    email,
    phone,
    category,
    message: String(payload?.message || "").trim(),
    eventName: String(payload?.eventName || "").trim() || undefined,
  });
};

export const getAllPartnershipEnquiriesService = async (query: any = {}) => {
  const { page = 1, limit = 10, search = "", status = "" } = query;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const skip = (pageNum - 1) * limitNum;

  const filter: any = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { organization: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
    ];
  }
  if (status) filter.status = status;

  const [enquiries, total] = await Promise.all([
    PartnershipEnquiry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    PartnershipEnquiry.countDocuments(filter),
  ]);

  return { enquiries, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
};

export const getPartnershipEnquiryByIdService = async (id: string) => PartnershipEnquiry.findById(id);

export const updatePartnershipEnquiryService = async (id: string, payload: any) => {
  // Only the status is editable from the admin.
  const update: any = {};
  if (payload?.status) update.status = payload.status;
  return PartnershipEnquiry.findByIdAndUpdate(id, update, { new: true, runValidators: true });
};

export const deletePartnershipEnquiryService = async (id: string) => PartnershipEnquiry.findByIdAndDelete(id);
