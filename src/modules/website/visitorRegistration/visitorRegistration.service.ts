import VisitorRegistration, {
  VISITOR_CATEGORIES,
  VISITOR_STATUSES,
  VISITOR_SUBTYPES,
} from "../../../models/visitor/visitorRegistration.model";
import { ApiError } from "../../../utils/ApiError";
import { emailProblem } from "../../../utils/emailCheck";

type Category = (typeof VISITOR_CATEGORIES)[number];
type SubType = (typeof VISITOR_SUBTYPES)[number];

const text = (v: unknown, max = 300) => (typeof v === "string" || typeof v === "number" ? String(v).trim().slice(0, max) : "");
const fullName = (o: any) => [text(o?.firstName, 80), text(o?.lastName, 80)].filter(Boolean).join(" ") || text(o?.name, 160);

// Fields that are never stored in `details` (verification state, declarations already implied by submitting)
const SKIP_KEYS = new Set(["otp", "emailOtp", "mobileOtp", "password", "files"]);

/** Copies what the visitor filled into plain JSON: trimmed strings, numbers, booleans, small arrays/objects. */
const clean = (value: unknown, depth = 0): unknown => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return value.trim().slice(0, 2000) || undefined;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth > 3) return undefined;
  if (Array.isArray(value)) {
    const out = value.slice(0, 50).map((v) => clean(v, depth + 1)).filter((v) => v !== undefined);
    return out.length ? out : undefined;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
      if (k.startsWith("_") || SKIP_KEYS.has(k)) continue;
      const c = clean(v, depth + 1);
      if (c !== undefined) out[k] = c;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
};

const PREFIX: Record<Category, string> = { domestic: "BOE27-DV", international: "BOE27-IV", group: "BOE27-GV" };

const nextRegistrationNo = async (category: Category) => {
  const prefix = PREFIX[category];
  const last: any = await VisitorRegistration.findOne({ registrationNo: new RegExp(`^${prefix}-\\d+$`) })
    .sort({ createdAt: -1 })
    .select("registrationNo")
    .lean();
  const n = last ? parseInt(String(last.registrationNo).split("-").pop() || "0", 10) : 0;
  return `${prefix}-${String(n + 1).padStart(5, "0")}`;
};

const createWithNumber = async (category: Category, doc: Record<string, unknown>) => {
  // Two submits at the same moment can pick the same number; retry with the next one.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await VisitorRegistration.create({ ...doc, category, registrationNo: await nextRegistrationNo(category) });
    } catch (err: any) {
      if (err?.code !== 11000) throw err;
    }
  }
  throw ApiError.internal("Could not create the registration. Please try again.");
};

const requireContact = (name: string, email: string, mobile: string) => {
  if (!name) throw ApiError.badRequest("Please enter the visitor's name.");
  const emailError = emailProblem(email);
  if (emailError) throw ApiError.badRequest(emailError);
  if (!/^\+?\d[\d\s-]{6,18}$/.test(mobile)) throw ApiError.badRequest("Please enter a valid mobile number.");
};

/** Last 10 digits, so "+91 98765 43210" and "9876543210" are the same number */
const mobileKey = (mobile: string) => mobile.replace(/\D/g, "").slice(-10);

/**
 * One registration per mobile number (and per email) for an event: a second submit is refused
 * with the number already issued, instead of creating a duplicate pass.
 */
const refuseDuplicate = async (eventName: string, mobile: string, email: string) => {
  const digits = mobileKey(mobile);
  if (digits.length < 6) return;
  const existing: any = await VisitorRegistration.findOne({
    ...(eventName ? { eventName } : {}),
    $or: [
      { mobile: { $regex: `${digits}$` } },
      { "persons.mobile": { $regex: `${digits}$` } },
      ...(email ? [{ email }, { "persons.email": email }] : []),
    ],
  })
    .select("registrationNo mobile email")
    .lean();
  if (!existing) return;
  const by = mobileKey(String(existing.mobile || "")) === digits ? "mobile number" : "email";
  throw new ApiError(409, `This ${by} is already registered for the expo (registration no. ${existing.registrationNo}). Please use a different ${by}, or contact us for your pass.`);
};

/** Domestic (corporate / general / health camp) and international: one person per registration. */
export const createSingleVisitorService = async (category: "domestic" | "international", subType: SubType | "", body: any) => {
  const name = fullName(body);
  const email = text(body?.email, 200).toLowerCase();
  const mobile = text(body?.mobile || body?.mobileNo, 25);
  requireContact(name, email, mobile);
  await refuseDuplicate(text(body?.registrationFor, 60), mobile, email);

  return createWithNumber(category, {
    subType,
    eventName: text(body?.registrationFor, 60),
    name,
    email,
    mobile,
    companyName: text(body?.companyName, 200),
    designation: text(body?.designation || body?.occupation, 120),
    country: text(body?.country, 80),
    state: text(body?.state, 80),
    city: text(body?.city, 80),
    nationality: text(body?.nationality, 80),
    details: clean(body) || {},
  });
};

/** Group: { company, persons[] } — persons[0] is the primary contact. */
export const createGroupVisitorService = async (body: any) => {
  const company = body?.company || {};
  const persons = (Array.isArray(body?.persons) ? body.persons : []).slice(0, 10).map((p: any) => ({
    firstName: text(p?.firstName, 80),
    lastName: text(p?.lastName, 80),
    gender: text(p?.gender, 20),
    designation: text(p?.designation, 120),
    email: text(p?.email, 200).toLowerCase(),
    mobile: text(p?.mobile || p?.mobileNo, 25),
  }));
  if (persons.length < 1) throw ApiError.badRequest("Please add the group members.");
  const primary = persons[0];
  const name = fullName(primary);
  requireContact(name, primary.email, primary.mobile);
  if (!text(company?.companyName)) throw ApiError.badRequest("Please enter the organisation name.");

  // No member twice in the group, and nobody already registered
  const seen = new Set<string>();
  for (const [i, p] of persons.entries()) {
    const key = mobileKey(p.mobile);
    const nameKey = `${p.firstName} ${p.lastName}`.trim().toLowerCase().replace(/\s+/g, " ");
    if (emailProblem(p.email)) throw ApiError.badRequest(`Person ${i + 1}: ${emailProblem(p.email)}`);
    if (!p.firstName || !/^\+?\d[\d\s-]{6,18}$/.test(p.mobile)) {
      throw ApiError.badRequest(`Please complete the name, email and mobile number of person ${i + 1}.`);
    }
    for (const k of [`m:${key}`, `e:${p.email}`, `n:${nameKey}`]) {
      if (seen.has(k)) throw ApiError.badRequest(`Person ${i + 1} repeats another member's ${k[0] === "m" ? "mobile number" : k[0] === "e" ? "email" : "name"}. Each member must be a different person.`);
      seen.add(k);
    }
  }
  for (const p of persons) await refuseDuplicate(text(company?.registrationFor, 60), p.mobile, p.email);

  return createWithNumber("group", {
    eventName: text(company?.registrationFor, 60),
    name,
    email: primary.email,
    mobile: primary.mobile,
    companyName: text(company?.companyName, 200),
    designation: primary.designation,
    country: text(company?.country, 80),
    state: text(company?.state, 80),
    city: text(company?.city, 80),
    persons,
    details: clean(company) || {},
  });
};

export const listVisitorRegistrationsService = async (query: any = {}) => {
  const filter: Record<string, unknown> = {};
  if (VISITOR_CATEGORIES.includes(query?.category)) filter.category = query.category;
  if (VISITOR_SUBTYPES.includes(query?.subType)) filter.subType = query.subType;
  if (VISITOR_STATUSES.includes(query?.status)) filter.status = query.status;
  const limit = Math.min(parseInt(query?.limit, 10) || 1000, 2000);
  const [registrations, total] = await Promise.all([
    VisitorRegistration.find(filter).sort({ createdAt: -1 }).limit(limit).select("-details").lean(),
    VisitorRegistration.countDocuments(filter),
  ]);
  return { registrations, total };
};

export const getVisitorRegistrationService = async (id: string) => {
  const doc = await VisitorRegistration.findById(id).lean();
  if (!doc) throw ApiError.notFound("Visitor registration not found.");
  return doc;
};

export const updateVisitorStatusService = async (id: string, status: unknown, by: string) => {
  if (!VISITOR_STATUSES.includes(status as any)) {
    throw ApiError.badRequest(`Status must be one of: ${VISITOR_STATUSES.join(", ")}`);
  }
  const doc = await VisitorRegistration.findByIdAndUpdate(
    id,
    { status, statusUpdatedBy: by, statusUpdatedAt: new Date() },
    { new: true, runValidators: true }
  ).select("-details");
  if (!doc) throw ApiError.notFound("Visitor registration not found.");
  return doc;
};

export const deleteVisitorRegistrationService = async (id: string) => {
  const doc = await VisitorRegistration.findByIdAndDelete(id);
  if (!doc) throw ApiError.notFound("Visitor registration not found.");
  return doc;
};
