import { isValidObjectId } from "mongoose";
import BlogExpert, { BLOG_EXPERT_STATUSES } from "../../models/blog/blogExpert.model";
import BlogExperts from "../../models/blog/blogExperts.model";
import { ApiError } from "../../utils/ApiError";
import { seedOnce } from "../../utils/seedOnce";

const NAME_RE = /^\p{L}[\p{L}\p{M} .'()-]*$/u;
const URL_RE = /^(https?:\/\/[^\s]+|\/[^\s]*)$/i;
export const BLOG_EXPERT_LIMITS = { name: 80, role: 100, quote: 220 } as const;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max + 1) : "");
const stripQuotes = (s: string) => s.replace(/^["“”']+|["“”']+$/g, "").trim();

/** The experts the website showed before they were managed here */
const STARTER = [
  { name: "Dr. Ramesh Patel", role: "Organic Farming Expert", quote: "Organic agriculture is not just a choice, it's the need of the hour for a sustainable future." },
  { name: "Ms. Anita Verma", role: "CEO, Organic India", quote: "Consumer awareness and trust are the strongest pillars of the organic movement." },
  { name: "Mr. Suresh Kumar", role: "Founder, 24 Mantra Organic", quote: "From our farms to your table, organic is our promise for a healthier India." },
  { name: "Dr. Neha Sharma", role: "Sustainability Expert", quote: "Sustainable living begins with conscious choices we make every day." },
  { name: "Mr. Arjun Singh", role: "Agri Entrepreneur", quote: "Innovation and collaboration are driving India's organic future forward." },
];

/**
 * First use: start from the experts saved in the older single-record section (if any),
 * otherwise from the five the website showed, so the page looks the same until edited.
 */
const ensureSeeded = () =>
  seedOnce("blog-experts", BlogExpert, async () => {
    const legacy = (await BlogExperts.findOne().lean())?.experts?.filter((e) => e?.name && e?.quote) ?? [];
    const list = legacy.length
      ? legacy.map((e) => ({ name: e.name!, role: e.role || "Expert", quote: e.quote!, image: e.img || "" }))
      : STARTER.map((e) => ({ ...e, image: "" }));
    await BlogExpert.insertMany(list.map((e, i) => ({ ...e, order: i + 1 })));
  });

const sorted = { order: 1 as const, createdAt: 1 as const };

/** Website: published experts in order */
export const listPublicBlogExpertsService = async () => {
  await ensureSeeded();
  return BlogExpert.find({ status: "published" }).sort(sorted).select("name role quote image order").lean();
};

/** Admin: every expert */
export const listBlogExpertsService = async () => {
  await ensureSeeded();
  return BlogExpert.find().sort(sorted).lean();
};

const readPayload = (body: Record<string, unknown>, partial: boolean) => {
  const data: Record<string, unknown> = {};
  const errors: string[] = [];
  const need = (field: string) => !partial || body[field] !== undefined;

  if (need("name")) {
    const name = text(body.name, BLOG_EXPERT_LIMITS.name);
    if (!name) errors.push("Expert name is required.");
    else if (name.length < 2 || name.length > BLOG_EXPERT_LIMITS.name) errors.push(`Expert name must be 2–${BLOG_EXPERT_LIMITS.name} characters.`);
    else if (!NAME_RE.test(name)) errors.push("Expert name can contain only letters, spaces, dots, hyphens and apostrophes.");
    data.name = name;
  }
  if (need("role")) {
    const role = text(body.role, BLOG_EXPERT_LIMITS.role);
    if (!role) errors.push("Designation / organisation is required.");
    else if (role.length < 2 || role.length > BLOG_EXPERT_LIMITS.role) errors.push(`Designation / organisation must be 2–${BLOG_EXPERT_LIMITS.role} characters.`);
    data.role = role;
  }
  if (need("quote")) {
    const quote = stripQuotes(text(body.quote, BLOG_EXPERT_LIMITS.quote + 4));
    if (!quote) errors.push("Quote is required.");
    else if (quote.length < 10 || quote.length > BLOG_EXPERT_LIMITS.quote) errors.push(`Quote must be 10–${BLOG_EXPERT_LIMITS.quote} characters.`);
    data.quote = quote;
  }
  if (body.image !== undefined) {
    const image = typeof body.image === "string" ? body.image.trim() : "";
    if (image && (image.length > 1000 || !URL_RE.test(image))) errors.push("Photo must be an uploaded image link.");
    data.image = image;
  }
  if (body.status !== undefined) {
    if (!BLOG_EXPERT_STATUSES.includes(body.status as never)) errors.push("Status must be published or hidden.");
    data.status = body.status;
  }
  if (body.order !== undefined && body.order !== "") {
    const order = Number(body.order);
    if (!Number.isInteger(order) || order < 0 || order > 9999) errors.push("Order must be a whole number from 0 to 9999.");
    data.order = order;
  }
  if (errors.length) throw new ApiError(400, errors[0], errors);
  return data;
};

export const createBlogExpertService = async (body: Record<string, unknown>) => {
  await ensureSeeded();
  const data = readPayload(body ?? {}, false);
  if (data.order === undefined) {
    const last = await BlogExpert.findOne().sort({ order: -1 }).select("order").lean();
    data.order = (last?.order ?? 0) + 1;
  }
  return BlogExpert.create(data);
};

const findOr404 = async (id: string) => {
  if (!isValidObjectId(id)) throw ApiError.badRequest("Invalid expert id.");
  const doc = await BlogExpert.findById(id);
  if (!doc) throw ApiError.notFound("Expert not found.");
  return doc;
};

export const updateBlogExpertService = async (id: string, body: Record<string, unknown>) => {
  const doc = await findOr404(id);
  doc.set(readPayload(body ?? {}, true));
  await doc.save();
  return doc;
};

export const deleteBlogExpertService = async (id: string) => {
  const doc = await findOr404(id);
  await doc.deleteOne();
  return doc;
};
