import PartnershipEnquiry from "../../../models/contact/partnershipEnquiry.model";
import Otp from "../../../models/contact/otp.model";
import { otpProofRequired } from "../../../utils/otpProof";
import { ApiError } from "../../../utils/ApiError";
import { resolveDropdownValue } from "../../dropdowns/dropdownValue";
import { emailProblem } from "../../../utils/emailCheck";

export const PARTNERSHIP_OTP_PROFILE = "PARTNERSHIP_ENQUIRY";

/**
 * The form only submits after the browser verified the WhatsApp OTP, but that check is
 * client-side. Here the server confirms a verified OTP record for this number actually
 * exists (and consumes it so it can't be replayed) — only when otpProofRequired() (see otpProof.ts).
 */
const consumeVerifiedPhone = async (phone: string) => {
  const record = await Otp.findOneAndDelete({ phone, isVerified: true, profile: PARTNERSHIP_OTP_PROFILE });
  if (!record && otpProofRequired()) {
    throw ApiError.badRequest("Please verify your WhatsApp number with OTP before submitting.");
  }
};

export const createPartnershipEnquiryService = async (payload: any) => {
  const name = String(payload?.name || "").trim();
  const organization = String(payload?.organization || "").trim();
  const email = String(payload?.email || "").trim();
  const phone = String(payload?.phone || "").trim();
  const rawCategory = String(payload?.category || "").trim();

  if (!name || !organization || !email || !phone || !rawCategory) {
    throw ApiError.badRequest("Full name, organization, email, mobile number and partnership category are required.");
  }

  const category = await resolveDropdownValue("partnership-category", rawCategory, {
    field: "Partnership category",
    required: true,
  });

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

/**
 * Home page "Interested in Sponsoring?" form (POST /sponsorship-enquiry). Saved with the
 * partnership enquiries (Admin → Partnership Enquiries) with the category "Sponsorship: …".
 * Its OTP is verified with the website's OTP service before submitting.
 */
export const createSponsorshipEnquiryService = async (payload: any) => {
  const name = String(payload?.fullName || payload?.name || "").trim().replace(/\s+/g, " ");
  const organization = String(payload?.companyName || payload?.organization || "").trim();
  const email = String(payload?.email || "").trim().toLowerCase();
  const digits = String(payload?.phone || "").replace(/\D/g, "");
  const phone = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  const message = String(payload?.message || "").trim();

  const problems = [
    !name && "Full name is required.",
    !!name && !/^\p{L}[\p{L}\p{M} .'-]{1,59}$/u.test(name) && "Full name can contain letters only.",
    !organization && "Company name is required.",
    emailProblem(email),
    !/^[6-9]\d{9}$/.test(phone) && "Please enter a valid 10-digit WhatsApp number.",
    message.length > 1000 && "Message must be 1000 characters or fewer.",
  ].filter(Boolean) as string[];
  if (problems.length) throw ApiError.badRequest(problems.join(" "));

  const category = await resolveDropdownValue("sponsorship-category", payload?.category, {
    field: "Sponsorship category",
    required: true,
  });

  // One enquiry per number per day is enough for the team; a second submit is not saved again
  const recent = await PartnershipEnquiry.findOne({
    phone,
    category: { $regex: "^Sponsorship:" },
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  }).lean();
  if (recent) throw new ApiError(409, "We have already received your sponsorship enquiry. Our team will contact you soon.");

  return await PartnershipEnquiry.create({
    name,
    organization,
    email,
    phone,
    category: `Sponsorship: ${category}`,
    message,
    eventName: String(payload?.eventName || "").trim() || "BOE2027",
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

const clean = (v: unknown, max = 200) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max + 1);
const NAME_RE = /^\p{L}[\p{L}\p{M} .'-]{1,59}$/u;
const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i;
const tenDigits = (v: unknown) => {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length === 12 && d.startsWith("91") ? d.slice(2) : d.length === 11 && d.startsWith("0") ? d.slice(1) : d;
};

/**
 * "Partner with us" forms on /partnership/hotel-stay-partner, travel-partner, logistics-partner,
 * stall-design-partner, printing-branding-partner and manpower-supply-partner
 * (POST /partnership-enquiry/partner). Saved with the partnership enquiries (Admin → Partnership
 * Enquiries) as category "Partner: <preferred category>".
 */
export const createPartnerRegistrationService = async (payload: any) => {
  const name = clean(payload?.name, 60);
  const designation = clean(payload?.designation, 80);
  const email = clean(payload?.email, 120).toLowerCase();
  const phone = tenDigits(payload?.phone);
  const organization = clean(payload?.organization, 150);
  const website = clean(payload?.website, 200);
  const city = clean(payload?.city, 60);
  const about = String(payload?.message ?? "").trim().slice(0, 1001);

  const problems = [
    !name ? "Full name is required." : !NAME_RE.test(name) && "Full name can contain letters only (2–60).",
    !designation && "Designation is required.",
    emailProblem(email),
    !/^[6-9]\d{9}$/.test(phone) && "Please enter a valid 10-digit Indian mobile number.",
    !organization && "Organization / company name is required.",
    website && (website.length > 200 || !URL_RE.test(website)) && "Website must be a valid address, e.g. www.example.com.",
    !city ? "City is required." : !/^\p{L}[\p{L}\p{M} .'-]{1,59}$/u.test(city) && "City can contain letters only.",
    !about ? "Please tell us about your organization." : about.length < 10 ? "Tell us about your organization in at least 10 characters." : about.length > 1000 && "About your organization can be at most 1000 characters.",
    payload?.agreed !== true && "Please accept the Terms & Conditions and Privacy Policy.",
  ].filter(Boolean) as string[];
  if (problems.length) throw new ApiError(400, problems[0], problems);

  const state = await resolveDropdownValue("partner-state", payload?.state, { field: "State", required: true });
  const preferred = await resolveDropdownValue("partner-preferred-category", payload?.category, { field: "Preferred partner category", required: true });
  const category = `Partner: ${preferred}`;

  const recent = await PartnershipEnquiry.findOne({ phone, category, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }).lean();
  if (recent) throw new ApiError(409, "We have already received your partner registration. Our team will contact you soon.");

  // The admin's Partnership Enquiries page shows the message, so the extra details are listed in it too
  const details = [`Designation: ${designation}`, `City: ${city}, ${state}`, website ? `Website: ${website}` : ""].filter(Boolean).join("\n");
  return PartnershipEnquiry.create({
    name, organization, email, phone, category, designation, website, city, state,
    message: `${about}\n\n${details}`,
    source: "partner-page",
    eventName: "BOE2027",
  });
};

/**
 * E-Promotion page "Enquire now" popup (POST /partnership-enquiry/e-promotion), after the
 * WhatsApp OTP. Saved as category "E-Promotion: <opportunity>".
 */
export const createEPromotionEnquiryService = async (payload: any) => {
  const name = clean(payload?.name, 60);
  const organization = clean(payload?.organization, 150);
  const email = clean(payload?.email, 120).toLowerCase();
  const phone = tenDigits(payload?.phone);
  const opportunity = clean(payload?.opportunity, 80);
  const interests = (Array.isArray(payload?.interests) ? payload.interests : []).map((x: unknown) => clean(x, 60)).filter(Boolean).slice(0, 10);
  const message = String(payload?.message ?? "").trim().slice(0, 1001);

  const problems = [
    !name ? "Full name is required." : !NAME_RE.test(name) && "Full name can contain letters only (2–60).",
    !organization && "Company name is required.",
    emailProblem(email),
    !/^[6-9]\d{9}$/.test(phone) && "Please enter a valid 10-digit WhatsApp number.",
    !opportunity && interests.length === 0 && "Please choose what you are interested in.",
    message.length > 1000 && "Message can be at most 1000 characters.",
  ].filter(Boolean) as string[];
  if (problems.length) throw new ApiError(400, problems[0], problems);

  const category = `E-Promotion: ${opportunity || interests[0]}`;
  const recent = await PartnershipEnquiry.findOne({ phone, category, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }).lean();
  if (recent) throw new ApiError(409, "We have already received your enquiry for this. Our team will contact you soon.");

  const details = [interests.length ? `Interested in: ${interests.join(", ")}` : "", message].filter(Boolean).join("\n\n");
  return PartnershipEnquiry.create({ name, organization, email, phone, category, message: details, source: "e-promotion", eventName: "BOE2027" });
};
