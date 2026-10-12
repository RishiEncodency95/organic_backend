import { isValidObjectId } from "mongoose";
import BlogUpdate, { BLOG_UPDATE_STATUSES } from "../../models/blog/blogUpdate.model";
import { ApiError } from "../../utils/ApiError";
import { seedOnce } from "../../utils/seedOnce";

export const BLOG_UPDATE_LIMITS = { tag: 30, title: 120, description: 300 } as const;

const IMAGE_RE = /^(https?:\/\/[^\s]+|\/[^\s]*)$/i;
/** A site path ("/blog/my-post") or a full http(s) link — never javascript: and the like */
const LINK_RE = /^(\/(?!\/)[^\s]*|https?:\/\/[^\s]+)$/i;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max + 1) : "");

/** The two cards the website showed before they were managed here */
const STARTER = [
  {
    tag: "Expo Update",
    title: "Inside Bharat Organic Expo 2026",
    description: "A glimpse into grand launches, leading brands, knowledge sessions and business networking at India's biggest organic expo.",
    date: new Date("2026-05-07T00:00:00.000Z"),
    readMinutes: 3,
  },
  {
    tag: "Business Update",
    title: "Building New Opportunities Across India's Organic Ecosystem",
    description: "How exhibitors, buyers and partners are creating new markets and long-term growth opportunities.",
    date: new Date("2026-05-05T00:00:00.000Z"),
    readMinutes: 4,
  },
];

const ensureSeeded = () =>
  seedOnce("blog-updates", BlogUpdate, async () => {
    await BlogUpdate.insertMany(STARTER.map((u, i) => ({ ...u, image: "", link: "/blog/all-articles", order: i + 1 })));
  });

const sorted = { order: 1 as const, date: -1 as const };

/** Website: published updates in order */
export const listPublicBlogUpdatesService = async () => {
  await ensureSeeded();
  return BlogUpdate.find({ status: "published" }).sort(sorted).select("tag title description image date readMinutes link order").lean();
};

/** Admin: every update */
export const listBlogUpdatesService = async () => {
  await ensureSeeded();
  return BlogUpdate.find().sort(sorted).lean();
};

const readPayload = (body: Record<string, unknown>, partial: boolean) => {
  const data: Record<string, unknown> = {};
  const errors: string[] = [];
  const need = (field: string) => !partial || body[field] !== undefined;
  const L = BLOG_UPDATE_LIMITS;

  if (need("tag")) {
    const tag = text(body.tag, L.tag);
    if (!tag) errors.push("Tag is required.");
    else if (tag.length < 2 || tag.length > L.tag) errors.push(`Tag must be 2–${L.tag} characters.`);
    data.tag = tag;
  }
  if (need("title")) {
    const title = text(body.title, L.title);
    if (!title) errors.push("Title is required.");
    else if (title.length < 5 || title.length > L.title) errors.push(`Title must be 5–${L.title} characters.`);
    data.title = title;
  }
  if (need("description")) {
    const description = text(body.description, L.description);
    if (!description) errors.push("Short description is required.");
    else if (description.length < 10 || description.length > L.description) errors.push(`Short description must be 10–${L.description} characters.`);
    data.description = description;
  }
  if (need("date")) {
    const raw = typeof body.date === "string" ? body.date.trim() : "";
    const date = /^\d{4}-\d{2}-\d{2}/.test(raw) ? new Date(raw.slice(0, 10) + "T00:00:00.000Z") : new Date(NaN);
    if (!raw) errors.push("Date is required.");
    else if (isNaN(date.getTime())) errors.push("Date must be a valid date.");
    else if (date.getUTCFullYear() < 2000 || date.getTime() > Date.now() + 366 * 24 * 60 * 60 * 1000) errors.push("Date must be between 2000 and one year from today.");
    data.date = date;
  }
  if (body.readMinutes !== undefined && body.readMinutes !== "") {
    const n = Number(body.readMinutes);
    if (!Number.isInteger(n) || n < 1 || n > 60) errors.push("Read time must be a whole number of minutes from 1 to 60.");
    data.readMinutes = n;
  }
  if (body.image !== undefined) {
    const image = typeof body.image === "string" ? body.image.trim() : "";
    if (image && (image.length > 1000 || !IMAGE_RE.test(image))) errors.push("Image must be an uploaded image link.");
    data.image = image;
  }
  if (body.link !== undefined) {
    const link = typeof body.link === "string" ? body.link.trim() : "";
    if (link && (link.length > 500 || !LINK_RE.test(link))) errors.push("Link must be a page on this site (starting with /) or a full https:// address.");
    data.link = link;
  }
  if (body.status !== undefined) {
    if (!BLOG_UPDATE_STATUSES.includes(body.status as never)) errors.push("Status must be published or hidden.");
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

export const createBlogUpdateService = async (body: Record<string, unknown>) => {
  await ensureSeeded();
  const data = readPayload(body ?? {}, false);
  if (data.order === undefined) {
    const last = await BlogUpdate.findOne().sort({ order: -1 }).select("order").lean();
    data.order = (last?.order ?? 0) + 1;
  }
  return BlogUpdate.create(data);
};

const findOr404 = async (id: string) => {
  if (!isValidObjectId(id)) throw ApiError.badRequest("Invalid update id.");
  const doc = await BlogUpdate.findById(id);
  if (!doc) throw ApiError.notFound("Update not found.");
  return doc;
};

export const updateBlogUpdateService = async (id: string, body: Record<string, unknown>) => {
  const doc = await findOr404(id);
  doc.set(readPayload(body ?? {}, true));
  await doc.save();
  return doc;
};

export const deleteBlogUpdateService = async (id: string) => {
  const doc = await findOr404(id);
  await doc.deleteOne();
  return doc;
};
