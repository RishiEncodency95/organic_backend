/**
 * Where a page's SEO really lives.
 *
 * The website reads each page's title, description, canonical, share card and schema from the page's own record
 * (Pages & CMS → SEO Information, collection SitePage, field `seo`). The audit's fixes must be written THERE: a fix
 * written anywhere else never reaches the website, however often it is rebuilt.
 *
 * Pages without a Pages & CMS record (for example the Home page, which has its own module) keep using the Seo
 * collection, and the H1 override always stays in the Seo collection (the build step reads it from there).
 */
import { SitePage } from "../../models/sitePages/SitePage.model";
import { SITE_PAGES } from "../sitePages/sitePages.registry";
import { defaultSeo, updateSeo } from "../sitePages/sitePages.service";
import * as home2Service from "../home2/home2.service";
import { Home2Page } from "../../models/home2/Home2Page.model";
import { HOME2_PAGE_KEY } from "../home2/home2.defaults";

/** The fields a Pages & CMS record stores, among the ones an audit fix can touch */
export const SITE_PAGE_FIELDS = [
  "metaTitle",
  "ogTitle",
  "metaDescription",
  "ogDescription",
  "canonicalUrl",
  "canonicalTag",
  "ogImage",
  "ogImageAlt",
  "twitterCard",
  "twitterTitle",
  "twitterDescription",
  "twitterImage",
  "openGraphTags",
  "schemaMarkup",
  "robotsIndex",
  "robotsFollow",
] as const;
const FIELD_SET = new Set<string>(SITE_PAGE_FIELDS);

export const isSitePageField = (field: string): boolean => FIELD_SET.has(field);

const cleanPath = (p: string): string => (p.split(/[?#]/)[0].replace(/\/+$/, "") || "/").toLowerCase();

/** "/about-us" -> "aboutUs" (the Pages & CMS key), "/" -> "home2", or null when the route has no record there */
export function sitePageKeyForPath(path: string): string | null {
  const want = cleanPath(path);
  if (want === "/" || want === "home") return "home2";
  const def = SITE_PAGES.find((p) => p.path && !p.path.includes(":") && cleanPath(p.path) === want);
  return def ? def.key : null;
}

/** Every Pages & CMS page with the route it serves: [route, key] */
export const sitePageRoutes = (): Array<[string, string]> => [
  ["/", "home2"],
  ...SITE_PAGES.filter((p) => p.path && !p.path.includes(":")).map((p) => [cleanPath(p.path), p.key] as [string, string]),
];

/** The SEO the website uses for this page right now (the saved one, or the page's starting SEO if it was never saved) */
export async function readSitePageSeo(key: string): Promise<Record<string, any>> {
  if (key === "home2") {
    try {
      const page = await home2Service.getPage();
      return (page?.seo as Record<string, any>) || {};
    } catch {
      return {};
    }
  }
  const doc: any = await SitePage.findOne({ key }).select("seo").lean();
  if (doc?.seo) return doc.seo;
  const def = SITE_PAGES.find((p) => p.key === key);
  return def ? (defaultSeo(def) as Record<string, any>) : {};
}

/** Saves fields the same way the admin's own SEO save does (so schema is cleaned and the record is created if needed) */
export async function writeSitePageSeo(key: string, fields: Record<string, unknown>, by?: string): Promise<void> {
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) if (isSitePageField(k)) data[k] = v;
  if (key === "home2") {
    if (Object.keys(data).length) await home2Service.updateSeo(data, by);
    if (fields.h1Heading && typeof fields.h1Heading === "string" && fields.h1Heading.trim()) {
      await home2Service.updateSection("hero", { title: fields.h1Heading.trim() }, by);
    }
    return;
  }
  if (Object.keys(data).length) await updateSeo(key, data, by);
}

/**
 * Puts `before` back, but only where the field still holds what the fix wrote (`after`), unless `force`.
 * "stale": something was changed since (nothing is written). "missing": the page record no longer exists.
 */
export async function revertSitePageSeo(key: string, before: Record<string, unknown>, after: Record<string, unknown>, force: boolean, by?: string): Promise<"ok" | "stale" | "missing"> {
  if (key === "home2") {
    if (!(await Home2Page.exists({ key: HOME2_PAGE_KEY }))) return "missing";
    const $set: Record<string, unknown> = { updatedBy: by };
    const cond: Record<string, unknown> = { key: HOME2_PAGE_KEY };
    for (const [k, v] of Object.entries(before)) {
      if (!isSitePageField(k)) continue;
      $set[`seo.${k}`] = v;
      if (!force && k in after) cond[`seo.${k}`] = after[k];
    }
    const r = await Home2Page.updateOne(cond, { $set });
    return r.matchedCount > 0 ? "ok" : "stale";
  }
  if (!(await SitePage.exists({ key }))) return "missing";
  const $set: Record<string, unknown> = { updatedBy: by };
  const cond: Record<string, unknown> = { key };
  for (const [k, v] of Object.entries(before)) {
    if (!isSitePageField(k)) continue;
    $set[`seo.${k}`] = v;
    if (!force && k in after) cond[`seo.${k}`] = after[k];
  }
  const r = await SitePage.updateOne(cond, { $set });
  return r.matchedCount > 0 ? "ok" : "stale";
}
