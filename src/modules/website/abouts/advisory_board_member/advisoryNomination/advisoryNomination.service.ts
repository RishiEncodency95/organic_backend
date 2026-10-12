import { isValidObjectId } from "mongoose";
import AdvisoryNomination, { ADVISORY_NOMINATION_STATUSES } from "../../../../../models/advisory_board_member/advisoryNomination.model";
import Otp from "../../../../../models/contact/otp.model";
import { ApiError } from "../../../../../utils/ApiError";
import { otpProofRequired } from "../../../../../utils/otpProof";
import { resolveDropdownValues } from "../../../../dropdowns/dropdownValue";
import { emailProblem } from "../../../../../utils/emailCheck";

/*
 * Advisory Board nominations (website form /about/nominate_advisory_board).
 * The rules here repeat the website's, so the API cannot be used to skip them.
 */

const NAME_RE = /^\p{L}[\p{L}\p{M} .'-]*$/u;
const MOBILE_RE = /^[6-9]\d{9}$/;
const LINKEDIN_RE = /^(https?:\/\/)?([a-z]{2,3}\.)?linkedin\.com\/(in|pub|company)\/[A-Za-z0-9_%.-]+\/?(\?\S*)?$/i;

export const WORD_LIMITS = { achievements: 300, reason: 400, additionalInfo: 200 } as const;
/** Same nominee within this many days is treated as a repeat nomination */
const REPEAT_WINDOW_DAYS = 30;

const text = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
const longText = (v: unknown, max = 5000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
/** "+91 98765-43210" / "098765 43210" → "9876543210" */
const mobile = (v: unknown) => {
  const d = String(v ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  if (d.length === 11 && d.startsWith("0")) return d.slice(1);
  return d;
};

type Person = { name: string; designation: string; organisation: string; email: string; phone: string };

const personErrors = (p: Person, who: "Nominee" | "Your") => {
  const label = (field: string) => (who === "Nominee" ? `Nominee's ${field}` : `Your ${field}`);
  const errors: string[] = [];
  if (!p.name) errors.push(`${label("name")} is required.`);
  else if (p.name.length < 2 || p.name.length > 80 || !NAME_RE.test(p.name)) errors.push(`${label("name")} must be 2–80 letters.`);
  if (!p.designation) errors.push(`${label("designation")} is required.`);
  if (!p.organisation) errors.push(`${label("organisation / institution")} is required.`);
  if (!p.email) errors.push(`${label("email")} is required.`);
  else if (emailProblem(p.email, label("email"))) errors.push(emailProblem(p.email, label("email")));
  if (!p.phone) errors.push(`${label("mobile number")} is required.`);
  else if (!MOBILE_RE.test(p.phone)) errors.push(`${label("mobile number")} must be a valid 10-digit Indian number.`);
  return errors;
};

/** The website verifies each email / mobile with an OTP; the verified record is the proof (see otpProof.ts). */
const assertVerified = async (emails: string[], phones: string[]) => {
  if (!otpProofRequired()) return;
  const errors: string[] = [];
  for (const email of new Set(emails)) {
    if (!(await Otp.exists({ email, isVerified: true }))) errors.push(`${email} is not verified. Please verify it with the email OTP.`);
  }
  for (const phone of new Set(phones)) {
    if (!(await Otp.exists({ phone: { $in: [phone, `91${phone}`, `+91${phone}`] }, isVerified: true }))) {
      errors.push(`${phone} is not verified. Please verify it with the WhatsApp OTP.`);
    }
  }
  if (errors.length) throw new ApiError(400, errors[0], errors);
};

export const createAdvisoryNominationService = async (body: any) => {
  const nominee = {
    name: text(body?.nominee?.name, 80),
    designation: text(body?.nominee?.designation, 120),
    organisation: text(body?.nominee?.organisation, 200),
    industry: text(body?.nominee?.industry, 120),
    email: text(body?.nominee?.email, 120).toLowerCase(),
    phone: mobile(body?.nominee?.phone),
    linkedin: text(body?.nominee?.linkedin, 300),
  };
  const nominator = {
    name: text(body?.nominator?.name, 80),
    designation: text(body?.nominator?.designation, 120),
    organisation: text(body?.nominator?.organisation, 200),
    email: text(body?.nominator?.email, 120).toLowerCase(),
    phone: mobile(body?.nominator?.phone),
  };
  const data = {
    expertiseArea: text(body?.expertiseArea, 120),
    achievements: longText(body?.achievements),
    reason: longText(body?.reason),
    relationship: text(body?.relationship, 60),
    additionalInfo: longText(body?.additionalInfo, 2000),
    declaration: body?.declaration === true,
  };

  // ── Field rules ──
  const errors = [...personErrors(nominee, "Nominee"), ...personErrors(nominator, "Your")];
  if (!nominee.industry) errors.push("Nominee's industry / sector is required.");
  if (nominee.linkedin && !LINKEDIN_RE.test(nominee.linkedin)) errors.push("LinkedIn profile must be a linkedin.com/in/… link.");
  if (!data.expertiseArea) errors.push("Area of expertise is required.");
  if (!data.achievements) errors.push("Key achievements are required.");
  else if (words(data.achievements) < 10) errors.push("Key achievements must be at least 10 words.");
  else if (words(data.achievements) > WORD_LIMITS.achievements) errors.push(`Key achievements can be at most ${WORD_LIMITS.achievements} words.`);
  if (!data.reason) errors.push("The reason for the nomination is required.");
  else if (words(data.reason) < 10) errors.push("The reason for the nomination must be at least 10 words.");
  else if (words(data.reason) > WORD_LIMITS.reason) errors.push(`The reason for the nomination can be at most ${WORD_LIMITS.reason} words.`);
  if (words(data.additionalInfo) > WORD_LIMITS.additionalInfo) errors.push(`Additional information can be at most ${WORD_LIMITS.additionalInfo} words.`);
  if (!data.relationship) errors.push("Relationship with the nominee is required.");
  if (!data.declaration) errors.push("Please confirm that the information provided is accurate.");
  if (errors.length) throw new ApiError(400, errors[0], errors);

  // Dropdown answers must be options the admin currently offers (stored in their canonical form)
  const resolved = await resolveDropdownValues(
    { industry: nominee.industry, expertiseArea: data.expertiseArea, relationship: data.relationship },
    {
      industry: { list: "advisory-industry-sector", label: "Industry / sector", required: true },
      expertiseArea: { list: "advisory-expertise-area", label: "Area of expertise", required: true },
      relationship: { list: "advisory-relationship", label: "Relationship with the nominee", required: true },
    }
  );
  nominee.industry = resolved.industry;
  data.expertiseArea = resolved.expertiseArea;
  data.relationship = resolved.relationship;

  // ── Nominee vs nominator: the same person only for a self-nomination ──
  const selfNomination = data.relationship.trim().toLowerCase() === "self";
  if (selfNomination) {
    if (nominee.email !== nominator.email || nominee.phone !== nominator.phone) {
      throw new ApiError(400, "For a self-nomination, your email and mobile number must be the nominee's own.");
    }
  } else {
    const clash = [
      nominee.email === nominator.email && "Your email must be different from the nominee's. If you are nominating yourself, choose “Self” as the relationship.",
      nominee.phone === nominator.phone && "Your mobile number must be different from the nominee's. If you are nominating yourself, choose “Self” as the relationship.",
    ].filter(Boolean) as string[];
    if (clash.length) throw new ApiError(400, clash[0], clash);
  }

  // ── One open nomination per nominee at a time ──
  const since = new Date(Date.now() - REPEAT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const repeat = await AdvisoryNomination.findOne({
    status: { $ne: "rejected" },
    createdAt: { $gte: since },
    $or: [{ "nominee.email": nominee.email }, { "nominee.phone": nominee.phone }],
  })
    .select("_id")
    .lean();
  if (repeat) throw new ApiError(409, "This person has already been nominated recently. Our team is reviewing that nomination.");

  await assertVerified([nominee.email, nominator.email], [nominee.phone, nominator.phone]);

  return AdvisoryNomination.create({
    nominee,
    nominator,
    ...data,
    selfNomination,
    eventName: text(body?.eventName, 40) || "BOE2027",
  });
};

export const listAdvisoryNominationsService = async (query: any = {}) => {
  const filter: Record<string, unknown> = {};
  if (ADVISORY_NOMINATION_STATUSES.includes(query?.status)) filter.status = query.status;
  const search = text(query?.search, 100);
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { "nominee.name": rx },
      { "nominee.email": rx },
      { "nominee.phone": rx },
      { "nominee.organisation": rx },
      { "nominator.name": rx },
      { "nominator.email": rx },
    ];
  }
  const limit = Math.min(parseInt(query?.limit, 10) || 500, 2000);
  const [nominations, total] = await Promise.all([
    AdvisoryNomination.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
    AdvisoryNomination.countDocuments(filter),
  ]);
  return { nominations, total };
};

const findOr404 = async (id: string) => {
  if (!isValidObjectId(id)) throw ApiError.badRequest("Invalid nomination id.");
  const doc = await AdvisoryNomination.findById(id);
  if (!doc) throw ApiError.notFound("Nomination not found.");
  return doc;
};

export const getAdvisoryNominationService = async (id: string) => findOr404(id);

/** The team changes only the status and its own note; the submitted content stays as sent. */
export const updateAdvisoryNominationService = async (id: string, body: any, by: string) => {
  const doc = await findOr404(id);
  if (body?.status !== undefined) {
    if (!ADVISORY_NOMINATION_STATUSES.includes(body.status)) {
      throw ApiError.badRequest(`Status must be one of: ${ADVISORY_NOMINATION_STATUSES.join(", ")}.`);
    }
    if (doc.status !== body.status) {
      doc.status = body.status;
      doc.statusUpdatedBy = by;
      doc.statusUpdatedAt = new Date();
    }
  }
  if (body?.adminNote !== undefined) doc.adminNote = longText(body.adminNote, 2000);
  await doc.save();
  return doc;
};

export const deleteAdvisoryNominationService = async (id: string) => {
  const doc = await findOr404(id);
  await doc.deleteOne();
  return doc;
};
