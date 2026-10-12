import { isValidObjectId } from "mongoose";
import BlogCategory, { BLOG_CATEGORY_COLORS, BLOG_CATEGORY_ICONS, BLOG_CATEGORY_STATUSES } from "../../models/blog/blogCategory.model";
import BlogPost from "../../models/blog/blogPost.model";
import { ApiError } from "../../utils/ApiError";
import { liveBlogFilter } from "../blogPost/blogPost.service";
import { seedOnce } from "../../utils/seedOnce";

const text = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
const toSlug = (s: string) =>
  s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const key = (s: string) => s.trim().toLowerCase();
const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sameName = (name: string) => new RegExp(`^\\s*${escapeRx(name.trim())}\\s*$`, "i");

/** The categories the blog editor offered before categories were managed here */
const STARTER = ["Expo News", "Industry Stories", "Organic Trends", "Producer Guidance", "Ayurveda & Wellness", "Sustainable Agriculture"];
const STARTER_LOOK: [string, string][] = [
  ["newspaper", "sky"], ["trending-up", "indigo"], ["leaf", "green"], ["book-open", "amber"], ["heart", "rose"], ["sprout", "emerald"],
];

/**
 * First use: create the categories from the editor's old list plus any other category the
 * existing posts already use, so nothing written so far loses its category.
 */
const ensureSeeded = () =>
  seedOnce("blog-categories", BlogCategory, async () => {
    const used = (await BlogPost.distinct("category")).map((c) => text(c, 80)).filter(Boolean);
    const names: string[] = [];
    for (const n of [...STARTER, ...used]) if (!names.some((x) => key(x) === key(n))) names.push(n);
    await BlogCategory.insertMany(
      names.map((name, i) => {
        const [icon, color] = STARTER_LOOK[i] ?? [BLOG_CATEGORY_ICONS[i % BLOG_CATEGORY_ICONS.length], BLOG_CATEGORY_COLORS[i % BLOG_CATEGORY_COLORS.length]];
        return { name, slug: toSlug(name), icon, color, order: i + 1 };
      }),
      { ordered: false }
    ).catch(() => undefined); // a parallel first request may already have inserted them
  });

/** Posts per category name (case-insensitive); `liveOnly` counts only what visitors can see */
const postCounts = async (liveOnly: boolean) => {
  const rows = await BlogPost.aggregate<{ _id: string; n: number }>([
    ...(liveOnly ? [{ $match: liveBlogFilter() }] : []),
    { $group: { _id: { $toLower: { $trim: { input: { $ifNull: ["$category", ""] } } } }, n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.n]));
};

/** Website: published categories in order, with their number of live posts */
export const listPublicBlogCategoriesService = async () => {
  await ensureSeeded();
  const [cats, counts] = await Promise.all([
    BlogCategory.find({ status: "published" }).sort({ order: 1, name: 1 }).select("name slug description icon color order").lean(),
    postCounts(true),
  ]);
  return cats.map((c) => ({ ...c, postCount: counts.get(key(c.name)) ?? 0 }));
};

/** Admin: every category with its number of posts (any status) */
export const listBlogCategoriesService = async () => {
  await ensureSeeded();
  const [cats, counts] = await Promise.all([BlogCategory.find().sort({ order: 1, name: 1 }).lean(), postCounts(false)]);
  return cats.map((c) => ({ ...c, postCount: counts.get(key(c.name)) ?? 0 }));
};

const readPayload = (body: Record<string, unknown>, partial: boolean) => {
  const data: Record<string, unknown> = {};
  const errors: string[] = [];
  if (!partial || body.name !== undefined) {
    const name = text(body.name, 80);
    if (!name) errors.push("Category name is required.");
    else if (name.length < 2) errors.push("Category name must be at least 2 characters.");
    data.name = name;
  }
  // A new category without a slug gets one from its name; an edit keeps its slug unless one is sent
  if (!partial || body.slug !== undefined) {
    const slug = toSlug(text(body.slug, 100) || String(data.name ?? ""));
    if (!slug) errors.push("Slug must contain letters or numbers.");
    data.slug = slug;
  }
  if (body.description !== undefined) data.description = text(body.description, 400);
  if (body.icon !== undefined) {
    if (!BLOG_CATEGORY_ICONS.includes(body.icon as never)) errors.push("Choose an icon from the list.");
    data.icon = body.icon;
  }
  if (body.color !== undefined) {
    if (!BLOG_CATEGORY_COLORS.includes(body.color as never)) errors.push("Choose a colour from the list.");
    data.color = body.color;
  }
  if (body.status !== undefined) {
    if (!BLOG_CATEGORY_STATUSES.includes(body.status as never)) errors.push("Status must be published or hidden.");
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

const assertUnique = async (data: Record<string, unknown>, exceptId?: string) => {
  const not = exceptId ? { _id: { $ne: exceptId } } : {};
  const twin = data.name ? await BlogCategory.findOne({ ...not, name: sameName(String(data.name)) }).select("name").lean() : null;
  if (twin) throw ApiError.badRequest(`A category named "${twin.name}" already exists.`);
  if (data.slug && (await BlogCategory.exists({ ...not, slug: data.slug }))) {
    throw ApiError.badRequest(`The slug "${data.slug}" is already used by another category.`);
  }
};

export const createBlogCategoryService = async (body: Record<string, unknown>) => {
  await ensureSeeded();
  const data = readPayload(body ?? {}, false);
  await assertUnique(data);
  if (data.order === undefined) {
    const last = await BlogCategory.findOne().sort({ order: -1 }).select("order").lean();
    data.order = (last?.order ?? 0) + 1;
  }
  const doc = await BlogCategory.create(data);
  return { ...doc.toObject(), postCount: await BlogPost.countDocuments({ category: sameName(doc.name) }) };
};

const findOr404 = async (id: string) => {
  if (!isValidObjectId(id)) throw ApiError.badRequest("Invalid category id.");
  const doc = await BlogCategory.findById(id);
  if (!doc) throw ApiError.notFound("Category not found.");
  return doc;
};

export const updateBlogCategoryService = async (id: string, body: Record<string, unknown>) => {
  const doc = await findOr404(id);
  const data = readPayload(body ?? {}, true);
  await assertUnique(data, id);
  const oldName = doc.name;
  doc.set(data);
  await doc.save();
  // Posts keep pointing at the category under its new name
  if (data.name && data.name !== oldName) {
    await BlogPost.updateMany({ category: sameName(oldName) }, { $set: { category: doc.name } });
  }
  return { ...doc.toObject(), postCount: await BlogPost.countDocuments({ category: sameName(doc.name) }) };
};

/** A category still used by posts cannot be deleted (the posts would lose their category) */
export const deleteBlogCategoryService = async (id: string) => {
  const doc = await findOr404(id);
  const used = await BlogPost.countDocuments({ category: sameName(doc.name) });
  if (used) {
    throw ApiError.badRequest(
      `"${doc.name}" is used by ${used} post${used === 1 ? "" : "s"}. Move ${used === 1 ? "it" : "them"} to another category first, or hide this category instead.`
    );
  }
  await doc.deleteOne();
  return doc;
};
