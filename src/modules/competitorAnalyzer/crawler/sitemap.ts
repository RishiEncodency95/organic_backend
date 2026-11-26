import * as cheerio from "cheerio";

export interface SitemapParse {
  pages: { loc: string; lastmod: string | null }[];
  children: string[];
}

export function parseSitemap(xml: string, maxEntries = 5_000): SitemapParse {
  if (!xml || !/<(urlset|sitemapindex)\b/i.test(xml)) return { pages: [], children: [] };
  const $ = cheerio.load(xml, { xml: true });
  const pages: SitemapParse["pages"] = [];
  const children: string[] = [];
  $("sitemap > loc").each((_, el) => {
    if (children.length < 50) children.push($(el).text().trim());
  });
  $("url").each((_, el) => {
    if (pages.length >= maxEntries) return false;
    const loc = $(el).children("loc").first().text().trim();
    if (!loc) return;
    const lastmod = $(el).children("lastmod").first().text().trim() || null;
    pages.push({ loc, lastmod });
    return undefined;
  });
  return { pages, children: children.filter(Boolean) };
}
