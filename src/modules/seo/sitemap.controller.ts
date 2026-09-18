import { Request, Response } from "express";
import BlogPost from "../../models/blog/blogPost.model";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bharatorganicexpo.com";

// Static pages with their SEO priority and changeFreq
const staticPages = [
  { path: "", priority: 1.0, changeFreq: "weekly" },
  { path: "/about", priority: 0.9, changeFreq: "monthly" },
  { path: "/about/suport_services", priority: 0.7, changeFreq: "monthly" },
  { path: "/blog", priority: 0.9, changeFreq: "daily" },
  { path: "/gallery", priority: 0.8, changeFreq: "weekly" },
  { path: "/contact", priority: 0.8, changeFreq: "monthly" },
  { path: "/buyer-seller-meet", priority: 0.8, changeFreq: "monthly" },
  { path: "/why-exhibit", priority: 0.8, changeFreq: "monthly" },
  { path: "/why-visit", priority: 0.8, changeFreq: "monthly" },
  { path: "/exhibitors", priority: 0.8, changeFreq: "weekly" },
  { path: "/participate-as-exhibitor", priority: 0.8, changeFreq: "monthly" },
  { path: "/awards", priority: 0.7, changeFreq: "monthly" },
  { path: "/registration", priority: 0.8, changeFreq: "monthly" },
  { path: "/sponsorship", priority: 0.7, changeFreq: "monthly" },
  { path: "/partnership", priority: 0.7, changeFreq: "monthly" },
  { path: "/exhibition-categories", priority: 0.7, changeFreq: "monthly" },
  { path: "/e-promotion-web", priority: 0.6, changeFreq: "monthly" },
  { path: "/careers", priority: 0.6, changeFreq: "monthly" },
];

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function buildSitemapXml(
  urls: Array<{
    loc: string;
    lastmod: string;
    changefreq: string;
    priority: number;
  }>
): string {
  const urlsXml = urls
    .map(
      (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority.toFixed(1)}</priority>
  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urlsXml}
</urlset>`;
}

export async function generateSitemapXml(_req: Request, res: Response) {
  try {
    const today = toISODate(new Date());

    // 1. Build static page entries
    const staticEntries = staticPages.map((page) => ({
      loc: `${SITE_URL}${page.path}`,
      lastmod: today,
      changefreq: page.changeFreq,
      priority: page.priority,
    }));

    // 2. Fetch published blog posts from DB
    const blogs = await BlogPost.find(
      { status: { $in: ["published", "scheduled"] } },
      { slug: 1, updatedAt: 1, publishDate: 1 }
    ).lean();

    const blogEntries = blogs.map((blog: any) => ({
      loc: `${SITE_URL}/blog/${blog.slug}`,
      lastmod: toISODate(new Date(blog.updatedAt || blog.publishDate || new Date())),
      changefreq: "weekly",
      priority: 0.7,
    }));

    // 3. Combine all entries
    const allEntries = [...staticEntries, ...blogEntries];

    const xml = buildSitemapXml(allEntries);

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    return res.status(200).send(xml);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate sitemap",
    });
  }
}
