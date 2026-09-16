import BlogPost, { IBlogPost } from "../../models/blog/blogPost.model";
import Seo from "../../models/seo.model";

interface GetBlogsFilter {
  status?: string;
  showOnHome?: boolean | string;
  featured?: boolean | string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const getBlogPostsService = async (filters: GetBlogsFilter = {}) => {
  const query: any = {};

  if (filters.status && filters.status !== "all") {
    if (filters.status === "published") {
      query.status = { $in: ["published", "scheduled"] };
    } else {
      query.status = filters.status;
    }
  }

  if (filters.showOnHome !== undefined) {
    query.showOnHome =
      filters.showOnHome === true ||
      filters.showOnHome === "true" ||
      filters.showOnHome === "1";
  }

  if (filters.featured !== undefined) {
    query.featured =
      filters.featured === true ||
      filters.featured === "true" ||
      filters.featured === "1";
  }

  if (filters.category && filters.category !== "All") {
    query.category = filters.category;
  }

  if (filters.search) {
    const searchRegex = new RegExp(filters.search.trim(), "i");
    query.$or = [{ title: searchRegex }, { excerpt: searchRegex }, { tags: searchRegex }];
  }

  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    BlogPost.find(query).sort({ publishDate: -1, scheduledDate: -1, createdAt: -1 }).skip(skip).limit(limit),
    BlogPost.countDocuments(query),
  ]);

  posts.forEach((p: any) => {
    if (p.content) p.content = normalizeHtmlContent(p.content);
    if (p.excerpt) p.excerpt = stripHtmlForExcerpt(p.excerpt);
  });

  return {
    posts,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const getBlogPostByIdOrSlugService = async (idOrSlug: string, incrementView = false) => {
  let post: IBlogPost | null = null;

  // Check if valid ObjectId
  if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
    post = await BlogPost.findById(idOrSlug);
  }

  if (!post) {
    post = await BlogPost.findOne({ slug: idOrSlug.toLowerCase().trim() });
  }

  if (post && incrementView) {
    post.views = (post.views || 0) + 1;
    await post.save();
  }

  if (post && post.content) {
    post.content = normalizeHtmlContent(post.content);
  }
  if (post && post.excerpt) {
    post.excerpt = stripHtmlForExcerpt(post.excerpt);
  }

  return post;
};

// Sync SEO to Seo collection so both collections stay updated
const syncSeoEntry = async (post: IBlogPost) => {
  try {
    const pageKey = `blog/${post.slug}`;
    const defaultOrigin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3002";
    const canonical =
      post.canonicalUrl || post.canonicalTag || `${defaultOrigin}/blog/${post.slug}`;

    await Seo.findOneAndUpdate(
      { page: pageKey },
      {
        page: pageKey,
        metaTitle: post.metaTitle || post.title,
        metaDescription: post.metaDescription || post.excerpt,
        metaKeywords: post.metaKeywords,
        canonicalUrl: canonical,
        canonicalTag: `<link rel="canonical" href="${canonical}" />`,
        ogTitle: post.ogTitle || post.title,
        ogDescription: post.ogDescription || post.metaDescription || post.excerpt,
        ogImage: post.ogImage || post.image,
        schemaMarkup: post.schemaMarkup || "",
        openGraphTags: post.openGraphTags || "",
        isActive: true,
      },
      { upsert: true, new: true }
    );
  } catch (seoErr) {
    console.warn("Failed to sync blog SEO entry:", seoErr);
  }
};

export const normalizeHtmlContent = (raw?: string): string => {
  if (!raw) return "";
  let content = raw.trim();

  // Decode escaped HTML tags like &lt;h2&gt; or &lt;p&gt;
  if (/&lt;\s*\/?\s*(h[1-6]|p|div|ul|ol|li|strong|b|em|i|u|span|blockquote|br|a|img|hr)\b/i.test(content)) {
    content = content
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&amp;/gi, "&");
  }

  if (/&lt;\s*\/?\s*(h[1-6]|p|div|ul|ol|li|strong|b|em|i|u|span|blockquote|br|a|img|hr)\b/i.test(content)) {
    content = content
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">");
  }

  // If completely plain text without any tags at all:
  if (!/<(h[1-6]|p|div|ul|ol|li|blockquote|br)\b/i.test(content)) {
    content = content
      .split(/\n{2,}/)
      .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  return content;
};

export const stripHtmlForExcerpt = (raw?: string): string => {
  if (!raw) return "";
  return raw
    .replace(/&lt;[^&]*&gt;/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
};

export const createBlogPostService = async (payload: any) => {
  // Ensure unique slug
  let slug = (payload.slug || payload.title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  if (!slug) {
    slug = `blog-${Date.now()}`;
  }

  // Check collision
  const existing = await BlogPost.findOne({ slug });
  if (existing) {
    slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  if (payload.content) {
    payload.content = normalizeHtmlContent(payload.content);
  }

  // Auto-generate excerpt if not provided or empty, and ensure excerpt has no HTML tags
  let excerpt = stripHtmlForExcerpt(payload.excerpt || "");
  if (!excerpt && payload.content) {
    const plain = stripHtmlForExcerpt(payload.content);
    excerpt = plain.slice(0, 180) + (plain.length > 180 ? "..." : "");
  }

  let scheduledDate = payload.scheduledDate ? new Date(payload.scheduledDate) : null;
  let publishDate = payload.publishDate ? new Date(payload.publishDate) : (scheduledDate || new Date());
  if (scheduledDate && isNaN(scheduledDate.getTime())) scheduledDate = null;
  if (isNaN(publishDate.getTime())) publishDate = new Date();

  const post = await BlogPost.create({
    ...payload,
    slug,
    excerpt,
    scheduledDate,
    publishDate,
    showOnHome: Boolean(payload.showOnHome ?? payload.featured),
    featured: Boolean(payload.featured ?? payload.showOnHome),
    author: payload.author || "Bharat Organic Expo Admin",
  });

  await syncSeoEntry(post);
  return post;
};

export const updateBlogPostService = async (id: string, payload: any) => {
  // If slug is changing, ensure uniqueness
  if (payload.slug) {
    const slug = payload.slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const existing = await BlogPost.findOne({ slug, _id: { $ne: id } });
    if (existing) {
      payload.slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
    } else {
      payload.slug = slug;
    }
  }

  if (payload.content) {
    payload.content = normalizeHtmlContent(payload.content);
  }

  // Auto-generate excerpt if empty
  if (payload.excerpt !== undefined) {
    payload.excerpt = stripHtmlForExcerpt(payload.excerpt);
  }
  if (!payload.excerpt && payload.content) {
    const plain = stripHtmlForExcerpt(payload.content);
    payload.excerpt = plain.slice(0, 180) + (plain.length > 180 ? "..." : "");
  }

  const updateData: any = { ...payload };

  if (payload.scheduledDate !== undefined) {
    const sDate = payload.scheduledDate ? new Date(payload.scheduledDate) : null;
    updateData.scheduledDate = sDate && !isNaN(sDate.getTime()) ? sDate : null;
    if (sDate && !isNaN(sDate.getTime()) && !payload.publishDate) {
      updateData.publishDate = sDate;
    }
  }

  if (payload.publishDate !== undefined) {
    const pDate = new Date(payload.publishDate);
    if (!isNaN(pDate.getTime())) {
      updateData.publishDate = pDate;
    }
  }

  if (payload.showOnHome !== undefined || payload.featured !== undefined) {
    updateData.showOnHome = Boolean(payload.showOnHome ?? payload.featured);
    updateData.featured = Boolean(payload.featured ?? payload.showOnHome);
  }

  const post = await BlogPost.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
  if (post) {
    await syncSeoEntry(post);
  }
  return post;
};

export const deleteBlogPostService = async (id: string) => {
  const post = await BlogPost.findByIdAndDelete(id);
  if (post) {
    try {
      await Seo.findOneAndDelete({ page: `blog/${post.slug}` });
    } catch {}
  }
  return post;
};
