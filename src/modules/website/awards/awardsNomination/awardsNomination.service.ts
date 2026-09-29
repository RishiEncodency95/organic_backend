import AwardsNomination from "../../../../models/awards/awardsNomination.model";
import Otp from "../../../../models/contact/otp.model";
import { ApiError } from "../../../../utils/ApiError";
import { env } from "../../../../config/env";

const MOBILE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i;
const NAME_RE = /^[a-zA-Z][a-zA-Z .'-]*$/;
const STATUSES = ["pending", "shortlisted", "approved", "rejected"];

const TEXT_FIELDS = [
  "applicantType", "orgName", "contactPerson", "designation", "mobile", "email", "website",
  "city", "stateCountry", "awardCategory", "briefProfile", "yearsExperience", "teamSize",
  "keyServices", "keyAchievements", "uniqueContribution", "impactCreated", "innovation",
  "whyDeserve", "socialLink",
] as const;

const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

/** Same rules the website form enforces — repeated here so the API cannot be used to skip them. */
const validateNomination = (data: Record<string, any>): string[] => {
  const errors: string[] = [];
  const required: [string, string][] = [
    ["applicantType", "Applicant type"],
    ["orgName", "Full name / organisation name"],
    ["contactPerson", "Contact person"],
    ["mobile", "Mobile number"],
    ["email", "Email ID"],
    ["city", "City"],
    ["stateCountry", "State / country"],
    ["awardCategory", "Award category"],
    ["briefProfile", "Brief profile"],
    ["yearsExperience", "Years of experience"],
    ["keyServices", "Key services / products"],
    ["keyAchievements", "Key achievements"],
    ["uniqueContribution", "Unique contribution"],
    ["impactCreated", "Impact created"],
    ["whyDeserve", "Why you deserve this award"],
  ];
  for (const [key, label] of required) {
    if (!data[key]) errors.push(`${label} is required`);
  }

  if (data.orgName && data.orgName.length < 2) errors.push("Full name / organisation name is too short");
  if (data.contactPerson && !NAME_RE.test(data.contactPerson)) errors.push("Contact person must contain letters only");
  if (data.mobile && !MOBILE_RE.test(data.mobile)) errors.push("Mobile number must be a valid 10-digit Indian number");
  if (data.email && !EMAIL_RE.test(data.email)) errors.push("Email ID is not valid");
  if (data.website && !URL_RE.test(data.website)) errors.push("Website is not a valid URL");
  if (data.socialLink && !URL_RE.test(data.socialLink)) errors.push("Social link is not a valid URL");

  const profileWords = wordCount(data.briefProfile || "");
  if (data.briefProfile && (profileWords < 150 || profileWords > 200)) {
    errors.push(`Brief profile must be 150–200 words (currently ${profileWords})`);
  }
  if (data.whyDeserve && wordCount(data.whyDeserve) > 100) {
    errors.push("Why you deserve this award must be 100 words or fewer");
  }
  const achievementPoints = String(data.keyAchievements || "").split(/\n/).filter((l) => l.trim()).length;
  if (achievementPoints > 5) errors.push("Key achievements can have at most 5 points");

  if (data.declaration !== true) errors.push("Declaration must be accepted");
  return errors;
};

/** The website verifies both contacts by OTP; the verified OTP record is the proof. */
const assertContactsVerified = async (mobile: string, email: string) => {
  const [phoneOk, emailOk] = await Promise.all([
    Otp.exists({ phone: { $in: [mobile, `91${mobile}`, `+91${mobile}`] }, isVerified: true }),
    Otp.exists({ email, isVerified: true }),
  ]);

  // Development accepts the master OTP (123456), which verifies without a stored record.
  if (env.NODE_ENV !== "production") return;

  const errors: string[] = [];
  if (!phoneOk) errors.push("Mobile number is not verified. Please verify it with the WhatsApp OTP.");
  if (!emailOk) errors.push("Email ID is not verified. Please verify it with the email OTP.");
  if (errors.length) throw new ApiError(400, errors[0], errors);
};

export const createNominationService = async (payload: any, files?: any) => {
  const nominationData: Record<string, any> = {};
  for (const key of TEXT_FIELDS) {
    nominationData[key] = typeof payload?.[key] === "string" ? payload[key].trim() : "";
  }
  nominationData.email = nominationData.email.toLowerCase();
  nominationData.declaration = payload?.declaration === true || payload?.declaration === "true";

  const errors = validateNomination(nominationData);
  if (errors.length) throw new ApiError(400, errors[0], errors);

  await assertContactsVerified(nominationData.mobile, nominationData.email);
  nominationData.mobileVerified = true;
  nominationData.emailVerified = true;

  if (files) {
    if (files.deckFile && files.deckFile[0]) {
      nominationData.deckFile = `${files.deckFile[0].filename}`;
      nominationData.deckFileName = nominationData.deckFileName || files.deckFile[0].originalname;
    }
    if (files.certFile && files.certFile[0]) {
      nominationData.certFile = `${files.certFile[0].filename}`;
      nominationData.certFileName = nominationData.certFileName || files.certFile[0].originalname;
    }
    if (files.mediaFile && files.mediaFile[0]) {
      nominationData.mediaFile = `${files.mediaFile[0].filename}`;
      nominationData.mediaFileName = nominationData.mediaFileName || files.mediaFile[0].originalname;
    }
  }

  const nomination = await AwardsNomination.create(nominationData);
  return nomination;
};

export const getAllNominationsService = async (query: any = {}) => {
  const { page = 1, limit = 10, search = "", category = "", status = "" } = query;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const skip = (pageNum - 1) * limitNum;

  const filter: any = {};
  if (search) {
    filter.$or = [
      { orgName: { $regex: search, $options: "i" } },
      { contactPerson: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { mobile: { $regex: search, $options: "i" } },
    ];
  }
  if (category) {
    filter.awardCategory = category;
  }
  if (status) {
    filter.status = status;
  }

  const [nominations, total] = await Promise.all([
    AwardsNomination.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    AwardsNomination.countDocuments(filter),
  ]);

  return {
    nominations,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
};

export const getNominationByIdService = async (id: string) => {
  const nomination = await AwardsNomination.findById(id);
  return nomination;
};

// Admin review only changes the status; the applicant's submitted content stays as sent.
export const updateNominationService = async (id: string, payload: any) => {
  if (!STATUSES.includes(payload?.status)) {
    throw new ApiError(400, `Status must be one of: ${STATUSES.join(", ")}`);
  }
  const nomination = await AwardsNomination.findByIdAndUpdate(
    id,
    { status: payload.status },
    { new: true }
  );
  if (!nomination) throw new ApiError(404, "Nomination not found");
  return nomination;
};

export const deleteNominationService = async (id: string) => {
  const nomination = await AwardsNomination.findByIdAndDelete(id);
  return nomination;
};
