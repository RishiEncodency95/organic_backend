/**
 * Pending vs resolved SEO issues and the live health score.
 *
 * The audit snapshot is a photograph of the live (statically exported) website. A fix is written to MongoDB and only
 * reaches the website at the next build, so a snapshot alone keeps listing an issue that was already fixed. Here every
 * issue found in the latest crawl is checked against the CURRENT database state (Seo, AdvancedSeo.imageAlts, Redirect):
 * if the database already holds a compliant value the issue is "resolved" (awaiting the next website build) and it
 * leaves the pending list; a rolled-back fix restores the old value, so the issue comes back. The health score is
 * recomputed from that, from real data only.
 */
import { isGenericAlt } from "./altText";
import { RECOMMENDED_DESC, RECOMMENDED_TITLE } from "./pageFindings.service";
import { extractCanonicalUrl, validateCanonical } from "./canonicalUtil";
import SeoAuditSnapshot from "../../models/seoAudit.model";
import Seo from "../../models/seo.model";
import AdvancedSeo from "../../models/advancedSeo.model";
import { SitePage } from "../../models/sitePages/SitePage.model";
import { sitePageRoutes, isSitePageField, readSitePageSeo } from "./pageSeoStore";
import Redirect from "../../models/Redirect.model";
import SeoFixLog from "../../models/seoFixLog.model";
import { getSiteOrigin } from "../../config/seoSite";
import type { CrawlResult } from "./crawler.service";
import { isBrokenLink, linkStatusesFromList } from "./linkCheck.service";
import { normalizeFromPath } from "./redirectsExport";

/** A text compared without case, spaces and line breaks */
const sameText = (v: unknown): string => String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();

// the same lengths as the report's Meta Title / Meta Description checks (pageFindings.service)
export const TITLE_MIN = RECOMMENDED_TITLE.min;
export const TITLE_MAX = RECOMMENDED_TITLE.max;
export const DESC_MIN = RECOMMENDED_DESC.min;
export const DESC_MAX = RECOMMENDED_DESC.max;

export { isGenericAlt };

export type PendingIssueType = "title" | "description" | "canonical" | "h1" | "og" | "schema" | "image_alt" | "redirect" | "robots";
export type PendingAction = "auto_fix" | "redirect" | "override_h1";

export interface PendingIssue {
  id: string;
  route: string;
  pageUrl: string;
  issueType: PendingIssueType;
  severity: "critical" | "warning" | "notice";
  title: string;
  detail: string;
  currentValue: string | null;
  imageSrc?: string;
  actions: PendingAction[];
  /** Fixed in the database already, but the live website still shows the old value until its next build. */
  awaitingDeploy?: boolean;
}

const WEIGHT: Record<PendingIssueType, number> = {
  title: 1, description: 1, canonical: 1, h1: 1, og: 0.5, schema: 0.5, image_alt: 0.25, redirect: 1, robots: 1,
};
const SEVERITY: Record<PendingIssueType, PendingIssue["severity"]> = {
  title: "critical", description: "critical", canonical: "critical", h1: "critical", redirect: "critical", robots: "critical",
  og: "warning", schema: "warning", image_alt: "warning",
};
const MAX_LISTED = 500;

/** Mongoose Map keys cannot contain "." or start with "$": image URLs are stored with those characters escaped. */
export const imageAltKey = (src: string): string => src.replace(/%/g, "%25").replace(/\./g, "%2E").replace(/^[$_]/, (c) => (c === "$" ? "%24" : "%5F"));
export const imageAltSrc = (key: string): string => key.replace(/^%24/, "$").replace(/^%5F/, "_").replace(/%2E/g, ".").replace(/%25/g, "%");

export function pageKeyOf(path: string): string {
  const k = (path || "/").toLowerCase().replace(/^\/+|\/+$/g, "");
  return !k || k === "home" || k === "index" ? "home" : k;
}
const cleanPathOf = (key: string) => (key === "home" ? "/" : `/${key}`);

const lenOk = (s: string | null | undefined, min: number, max: number) => {
  const n = (s || "").trim().length;
  return n >= min && n <= max;
};

function pathOfUrl(href: string): string | null {
  try {
    const u = new URL(href, getSiteOrigin());
    return u.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
}

export interface PendingState {
  hasAudit: boolean;
  snapshotAt: string | null;
  reportScore: number | null;
  /** Health score if nothing had been fixed (all issues pending) */
  healthScoreAtAudit: number | null;
  /** Health score now: resolved fixes removed from pending */
  healthScore: number | null;
  pending: PendingIssue[];
  resolved: PendingIssue[];
  counts: { pending: number; resolved: number; critical: number; warning: number; notice: number };
  truncated: boolean;
}

export function scoreFrom(pendingWeight: number, possibleWeight: number): number | null {
  if (possibleWeight <= 0) return null;
  return Math.max(0, Math.min(100, Math.round(100 * (1 - pendingWeight / possibleWeight))));
}

export async function computePendingState(): Promise<PendingState> {
  const snap: any = await SeoAuditSnapshot.findOne()
    .sort({ createdAt: -1 })
    .select("createdAt report.seoScore linkChecks crawls.requestedPath crawls.httpStatus crawls.ok crawls.title crawls.metaDescription crawls.canonical crawls.h1 crawls.openGraph crawls.jsonLdBlocks crawls.images")
    .lean();
  if (!snap) {
    return { hasAudit: false, snapshotAt: null, reportScore: null, healthScoreAtAudit: null, healthScore: null, pending: [], resolved: [], counts: { pending: 0, resolved: 0, critical: 0, warning: 0, notice: 0 }, truncated: false };
  }
  const crawls: CrawlResult[] = Array.isArray(snap.crawls) ? snap.crawls : [];
  // An issue only counts as resolved when a non-reverted, applied fix was logged AFTER this snapshot was taken
  const [fixLogs, everFixedLogs, seoDocs, adv, redirects, sitePages] = await Promise.all([
    SeoFixLog.find({ status: "applied", reverted: false, createdAt: { $gte: snap.createdAt } }).select("route issueType newValue.imageSrc newValue.fromUrl").lean(),
    // every fix that is in force (applied, not undone), whenever it was made: it may be waiting for the website rebuild
    SeoFixLog.find({ status: "applied", reverted: false }).select("route issueType").lean(),
    Seo.find({}).select("page metaTitle metaDescription canonicalUrl canonicalTag ogTitle ogDescription ogImage schemaMarkup h1Heading robotsIndex robotsFollow").lean(),
    AdvancedSeo.findOne().select("imageAlts").lean(),
    Redirect.find({ isActive: true }).select("fromUrl").lean(),
    // what the website itself reads: each Pages & CMS record's SEO
    SitePage.find({}).select("key seo.metaTitle seo.metaDescription seo.canonicalUrl seo.canonicalTag seo.ogTitle seo.ogDescription seo.ogImage seo.schemaMarkup seo.robotsIndex seo.robotsFollow seo.twitterCard seo.twitterTitle seo.twitterDescription seo.twitterImage").lean(),
  ]);
  const fixed = new Set<string>();
  for (const l of fixLogs as any[]) {
    if (l.issueType === "image_alt" && l.newValue?.imageSrc) fixed.add(`image_alt::${l.newValue.imageSrc}`);
    else if (l.issueType === "redirect") fixed.add(`redirect::${normalizeFromPath(String(l.newValue?.fromUrl || l.route || ""))}`);
    else fixed.add(`${l.issueType}::${(l.route || "/").replace(/\/+$/, "") || "/"}`);
  }
  const everFixed = new Set<string>((everFixedLogs as any[]).map((l) => `${l.issueType}::${(l.route || "/").replace(/\/+$/, "") || "/"}`));
  const seoByKey = new Map<string, any>((seoDocs as any[]).map((d) => [String(d.page), d]));
  // a page that has a Pages & CMS record is judged by that record (what the website shows), not by the Seo collection
  const seoOfKey = new Map<string, any>((sitePages as any[]).map((d) => [String(d.key), d.seo || {}]));
  // the Home page keeps its SEO in its own record (home2)
  seoOfKey.set("home2", await readSitePageSeo("home2"));
  for (const [route, key] of sitePageRoutes()) {
    const own = seoOfKey.get(key);
    if (!own) continue;
    const pk = pageKeyOf(route);
    const merged: Record<string, any> = { ...(seoByKey.get(pk) || {}) };
    for (const [k, v] of Object.entries(own)) if (isSitePageField(k)) merged[k] = v;
    seoByKey.set(pk, merged);
  }
  const altMap: Record<string, string> = (() => {
    const a: any = (adv as any)?.imageAlts;
    if (!a) return {};
    return a instanceof Map ? Object.fromEntries(a) : a;
  })();
  const redirectFrom = new Set<string>();
  for (const r of redirects as any[]) {
    redirectFrom.add(normalizeFromPath(String(r.fromUrl)));
    const p = pathOfUrl(String(r.fromUrl));
    if (p) redirectFrom.add(normalizeFromPath(p));
  }

  const origin = getSiteOrigin();
  const pending: PendingIssue[] = [];
  const resolved: PendingIssue[] = [];
  let possible = 0;
  let pendingW = 0;
  let resolvedW = 0;
  const seenIds = new Set<string>();

  const push = (issue: Omit<PendingIssue, "id" | "severity" | "pageUrl">, isResolved: boolean) => {
    const id = `${issue.issueType}:${issue.route}:${issue.imageSrc ?? ""}`;
    if (seenIds.has(id)) return;
    seenIds.add(id);
    const full: PendingIssue = { ...issue, id, severity: SEVERITY[issue.issueType], pageUrl: `${origin}${issue.route === "/" ? "" : issue.route}` };
    if (isResolved) {
      resolved.push({ ...full, awaitingDeploy: true });
      resolvedW += WEIGHT[issue.issueType];
    } else {
      pending.push(full);
      pendingW += WEIGHT[issue.issueType];
    }
  };

  for (const c of crawls) {
    const route = pathOfUrl(c.requestedPath || "/") || "/";
    const key = pageKeyOf(route);
    const db = seoByKey.get(key);

    // A page that answers 404/410/5xx: the fix is a redirect (resolved once an active redirect exists for it).
    if (c.httpStatus === 404 || c.httpStatus === 410 || (c.httpStatus ?? 0) >= 500) {
      possible += WEIGHT.redirect;
      push(
        { route, issueType: "redirect", title: `Broken page (HTTP ${c.httpStatus})`, detail: `${route} does not load. Redirect it to the closest live page.`, currentValue: String(c.httpStatus), actions: ["redirect"] },
        fixed.has(`redirect::${normalizeFromPath(route)}`) && redirectFrom.has(normalizeFromPath(route))
      );
      continue;
    }
    if (!c.ok) continue;

    possible += WEIGHT.title + WEIGHT.description + WEIGHT.canonical + WEIGHT.h1 + WEIGHT.og + WEIGHT.schema + WEIGHT.robots;

    // 1. Title Tag Validation
    const dbTitle = typeof db?.metaTitle === "string" ? db.metaTitle.trim() : null;
    const effectiveTitle = dbTitle !== null ? dbTitle : (c.title?.trim() || null);

    if (!effectiveTitle) {
      push(
        { route, issueType: "title", title: "Missing title tag", detail: "Add a title tag between 30 and 65 characters.", currentValue: null, actions: ["auto_fix"] },
        false,
      );
    } else if (effectiveTitle.length < TITLE_MIN) {
      push(
        { route, issueType: "title", title: `Title too short (${effectiveTitle.length} characters)`, detail: `Title is under ${TITLE_MIN} characters. Target is ${TITLE_MIN}-${TITLE_MAX} characters.`, currentValue: effectiveTitle, actions: ["auto_fix"] },
        false,
      );
    } else if (effectiveTitle.length > TITLE_MAX) {
      push(
        { route, issueType: "title", title: `Title too long (${effectiveTitle.length} characters)`, detail: `Title exceeds ${TITLE_MAX} characters and will be truncated by search engines.`, currentValue: effectiveTitle, actions: ["auto_fix"] },
        false,
      );
    } else {
      // effectiveTitle is valid (30-65 chars)
      // the live page has no title, or one outside the limits: what is saved in the admin is waiting for the website
      if (!lenOk(c.title, TITLE_MIN, TITLE_MAX) && sameText(dbTitle) !== sameText(c.title)) {
        push(
          { route, issueType: "title", title: "Title tag updated in admin", detail: `Compliant title (${effectiveTitle.length} chars) saved in admin. Waiting for website build.`, currentValue: effectiveTitle, actions: ["auto_fix"] },
          true,
        );
      }
    }

    // 2. Meta Description Validation
    const dbDesc = typeof db?.metaDescription === "string" ? db.metaDescription.trim() : null;
    const effectiveDesc = dbDesc !== null ? dbDesc : (c.metaDescription?.trim() || null);

    if (!effectiveDesc) {
      push(
        { route, issueType: "description", title: "Missing meta description", detail: `Add a meta description between ${DESC_MIN} and ${DESC_MAX} characters.`, currentValue: null, actions: ["auto_fix"] },
        false,
      );
    } else if (effectiveDesc.length < DESC_MIN) {
      push(
        { route, issueType: "description", title: `Meta description too short (${effectiveDesc.length} characters)`, detail: `Description is under ${DESC_MIN} characters. Target is ${DESC_MIN}-${DESC_MAX} characters.`, currentValue: effectiveDesc, actions: ["auto_fix"] },
        false,
      );
    } else if (effectiveDesc.length > DESC_MAX) {
      push(
        { route, issueType: "description", title: `Meta description too long (${effectiveDesc.length} characters)`, detail: `Description exceeds ${DESC_MAX} characters and will be cut off in search snippets.`, currentValue: effectiveDesc, actions: ["auto_fix"] },
        false,
      );
    } else {
      // effectiveDesc is valid (70-160 chars)
      // the live page has no description, or one outside the limits: what is saved in the admin is waiting for the website
      if (!lenOk(c.metaDescription, DESC_MIN, DESC_MAX) && sameText(dbDesc) !== sameText(c.metaDescription)) {
        push(
          { route, issueType: "description", title: "Meta description updated in admin", detail: `Compliant description (${effectiveDesc.length} chars) saved in admin. Waiting for website build.`, currentValue: effectiveDesc, actions: ["auto_fix"] },
          true,
        );
      }
    }

    // 3. Canonical URL Validation
    const dbCanonical = extractCanonicalUrl(db?.canonicalUrl, db?.canonicalTag);
    const liveCanonical = c.canonical?.trim() || null;

    if (dbCanonical) {
      const v = validateCanonical(dbCanonical, route, origin);
      if (!v.ok) {
        // Admin configured an invalid or wrong canonical! Flag it as an active pending issue.
        push(
          {
            route,
            issueType: "canonical",
            title: v.title,
            detail: v.detail,
            currentValue: dbCanonical,
            actions: ["auto_fix"],
          },
          false,
        );
      } else {
        // dbCanonical is valid. If live canonical was missing or invalid, mark as resolved (awaiting website build).
        const liveVal = liveCanonical ? validateCanonical(liveCanonical, route, origin) : null;
        if (!liveVal || !liveVal.ok) {
          push(
            {
              route,
              issueType: "canonical",
              title: "Missing canonical link",
              detail: `Self-referencing canonical (${v.expectedUrl}) configured in admin.`,
              currentValue: dbCanonical,
              actions: ["auto_fix"],
            },
            true,
          );
        }
      }
    } else {
      // No canonical saved in admin DB: check what is on the live site
      if (!liveCanonical) {
        push(
          {
            route,
            issueType: "canonical",
            title: "Missing canonical link",
            detail: "Add a self-referencing canonical URL.",
            currentValue: null,
            actions: ["auto_fix"],
          },
          false,
        );
      } else {
        const v = validateCanonical(liveCanonical, route, origin);
        if (!v.ok) {
          push(
            {
              route,
              issueType: "canonical",
              title: v.title,
              detail: v.detail,
              currentValue: liveCanonical,
              actions: ["auto_fix"],
            },
            false,
          );
        }
      }
    }

    if (c.canonicalCount > 1) {
      push(
        {
          route,
          issueType: "canonical",
          title: "Multiple canonical tags",
          detail: `${c.canonicalCount} canonical tags found on the page. Only one canonical link is allowed.`,
          currentValue: liveCanonical,
          actions: ["auto_fix"],
        },
        false,
      );
    }

    // 4. H1 Headings Validation
    const h1Count = c.h1?.length ?? 0;
    const dbH1 = typeof db?.h1Heading === "string" ? db.h1Heading.trim() : null;

    if (dbH1 !== null) {
      if (!dbH1) {
        push(
          { route, issueType: "h1", title: "Empty H1 heading override", detail: "The H1 heading saved in admin is empty. Every page needs a main heading.", currentValue: null, actions: ["override_h1"] },
          false,
        );
      } else if (dbH1.length < 5) {
        push(
          { route, issueType: "h1", title: `H1 heading too short (${dbH1.length} chars)`, detail: "Make the H1 heading descriptive and keyword-focused (at least 5 characters).", currentValue: dbH1, actions: ["override_h1"] },
          false,
        );
      } else if (dbH1.length > 100) {
        push(
          { route, issueType: "h1", title: `H1 heading too long (${dbH1.length} chars)`, detail: "Keep H1 headings under 100 characters for clear page structure.", currentValue: dbH1, actions: ["override_h1"] },
          false,
        );
      } else {
        if (h1Count !== 1) {
          push(
            { route, issueType: "h1", title: "H1 heading configured in admin", detail: `Valid H1 heading ("${dbH1}") saved in admin. Waiting for deploy.`, currentValue: dbH1, actions: ["override_h1"] },
            true,
          );
        }
      }
    } else {
      if (h1Count === 0) {
        push(
          { route, issueType: "h1", title: "Missing H1 heading", detail: "A page needs exactly one H1 heading.", currentValue: null, actions: ["override_h1"] },
          false,
        );
      } else if (h1Count > 1) {
        push(
          { route, issueType: "h1", title: `${h1Count} H1 headings on the page`, detail: "A page needs exactly one H1. Reduce extra H1 headings to H2.", currentValue: c.h1?.[0] ?? null, actions: ["override_h1"] },
          false,
        );
      }
    }

    // 5. Open Graph & Social Cards Validation
    const og = c.openGraph || {};
    const effectiveOgTitle = db?.ogTitle?.trim() || og["og:title"]?.trim() || dbTitle || c.title?.trim() || "";
    const effectiveOgDesc = db?.ogDescription?.trim() || og["og:description"]?.trim() || dbDesc || c.metaDescription?.trim() || "";
    const effectiveOgImg = db?.ogImage?.trim() || og["og:image"]?.trim() || "";

    if (!effectiveOgImg) {
      push(
        { route, issueType: "og", title: "Missing Open Graph image", detail: "Add an og:image in Pages & CMS → SEO so social share cards display an image.", currentValue: null, actions: ["auto_fix"] },
        false,
      );
    } else if (!/^https?:\/\//i.test(effectiveOgImg) && !effectiveOgImg.startsWith("/")) {
      push(
        { route, issueType: "og", title: "Invalid Open Graph image URL", detail: `The og:image URL ("${effectiveOgImg}") is not a valid absolute URL or path.`, currentValue: effectiveOgImg, actions: ["auto_fix"] },
        false,
      );
    }

    if (!effectiveOgTitle) {
      push(
        { route, issueType: "og", title: "Missing Open Graph title", detail: "Add og:title for social sharing previews.", currentValue: null, actions: ["auto_fix"] },
        false,
      );
    }

    if (!effectiveOgDesc) {
      push(
        { route, issueType: "og", title: "Missing Open Graph description", detail: "Add og:description for social sharing previews.", currentValue: null, actions: ["auto_fix"] },
        false,
      );
    }

    if (db?.twitterCard && db.twitterCard !== "summary" && db.twitterCard !== "summary_large_image") {
      push(
        { route, issueType: "og", title: "Invalid Twitter Card type", detail: `Twitter card "${db.twitterCard}" is invalid. Must be "summary" or "summary_large_image".`, currentValue: db.twitterCard, actions: ["auto_fix"] },
        false,
      );
    }
    if (db?.twitterImage && !/^https?:\/\//i.test(db.twitterImage) && !db.twitterImage.startsWith("/")) {
      push(
        { route, issueType: "og", title: "Invalid Twitter image URL", detail: `The twitter:image URL ("${db.twitterImage}") is invalid.`, currentValue: db.twitterImage, actions: ["auto_fix"] },
        false,
      );
    }

    if (effectiveOgImg && effectiveOgTitle && effectiveOgDesc && (!og["og:title"] || !og["og:description"] || !og["og:image"])) {
      push(
        { route, issueType: "og", title: "Open Graph tags configured in admin", detail: "Complete Open Graph share tags saved in admin. Waiting for deploy.", currentValue: effectiveOgTitle, actions: ["auto_fix"] },
        true,
      );
    } else {
      // a share tag saved in the admin that the live page does not have yet: it moves to "waiting for website" instead of vanishing
      const pieces: Array<[string, string | undefined, string | null | undefined]> = [
        ["title", db?.ogTitle?.trim(), og["og:title"]],
        ["description", db?.ogDescription?.trim(), og["og:description"]],
        ["image", db?.ogImage?.trim(), og["og:image"]],
      ];
      for (const [name, saved, live] of pieces) {
        if (saved && !live?.trim()) {
          push(
            { route, issueType: "og", title: `Open Graph ${name} saved in admin`, detail: `The Open Graph ${name} is saved in admin. Waiting for the website to show it.`, currentValue: saved, actions: ["auto_fix"] },
            true,
          );
        }
      }
    }

    // 6. Structured Data / Schema (JSON-LD) Validation
    const dbSchema = typeof db?.schemaMarkup === "string" ? db.schemaMarkup.trim() : null;
    if (dbSchema) {
      const cleanedSchema = dbSchema.replace(/<script[^>]*>/gi, "").replace(/<\/script>/gi, "").trim();
      try {
        const parsed = JSON.parse(cleanedSchema);
        const target = Array.isArray(parsed) ? parsed[0] : parsed;
        if (!target || typeof target !== "object") {
          push(
            { route, issueType: "schema", title: "Invalid JSON-LD schema", detail: "Schema markup must be a valid JSON object or array.", currentValue: dbSchema.slice(0, 100), actions: ["auto_fix"] },
            false,
          );
        } else if (!target["@context"] && !target["@type"]) {
          push(
            { route, issueType: "schema", title: "Incomplete Schema.org markup", detail: "Schema markup must define '@context' and '@type'.", currentValue: dbSchema.slice(0, 100), actions: ["auto_fix"] },
            false,
          );
        } else {
          if ((c.jsonLdBlocks ?? 0) === 0) {
            push(
              { route, issueType: "schema", title: "Structured data configured in admin", detail: `Valid schema (${target["@type"] || "JSON-LD"}) configured in admin. Waiting for deploy.`, currentValue: target["@type"] || null, actions: ["auto_fix"] },
              true,
            );
          }
        }
      } catch (err: any) {
        push(
          { route, issueType: "schema", title: "Invalid JSON-LD schema syntax", detail: `Schema markup JSON parse error: ${err.message}.`, currentValue: dbSchema.slice(0, 100), actions: ["auto_fix"] },
          false,
        );
      }
    } else {
      if ((c.jsonLdBlocks ?? 0) === 0) {
        push(
          { route, issueType: "schema", title: "No structured data (JSON-LD)", detail: "Add Organization / Service JSON-LD schema in Pages & CMS → SEO.", currentValue: null, actions: ["auto_fix"] },
          false,
        );
      }
    }

    // 7. Robots Directives Validation
    // The live page decides: a page that is noindex on the website stays a problem until the website says otherwise. Only
    // when the admin really fixed it (index saved after a logged fix) it moves to "waiting for website".
    const robotsKey = `robots::${route.replace(/\/+$/, "") || "/"}`;
    const adminFixedIndex = db?.robotsIndex === true && (fixed.has(robotsKey) || everFixed.has(robotsKey));
    if (!c.indexable && adminFixedIndex) {
      push(
        { route, issueType: "robots", title: "Indexing enabled in admin", detail: "Indexing is switched on in admin. Waiting for the website to show it.", currentValue: "index", actions: ["auto_fix"] },
        true,
      );
    }
    const isNoindex = db?.robotsIndex === false || (!c.indexable && !adminFixedIndex);
    if (isNoindex) {
      push(
        {
          route,
          issueType: "robots",
          title: "Page marked as noindex",
          detail: "This page has a noindex directive and will not appear in Google search results. Enable indexing in Pages & CMS unless intentional.",
          currentValue: db?.robotsIndex === false ? "robotsIndex: false" : (c.robotsMeta || "noindex"),
          actions: ["auto_fix"],
        },
        false,
      );
    }
    const isNofollow = db?.robotsFollow === false || (c.nofollowMeta && db?.robotsFollow !== true);
    if (isNofollow) {
      push(
        {
          route,
          issueType: "robots",
          title: "Page marked as nofollow",
          detail: "Links on this page are marked nofollow, preventing search engines from passing authority downstream.",
          currentValue: "nofollow",
          actions: ["auto_fix"],
        },
        false,
      );
    }
    for (const img of c.images ?? []) {
      if (!img.src || img.isDecorative) continue;
      possible += WEIGHT.image_alt;
      const currentDbAlt = altMap[imageAltKey(img.src)]?.trim();
      const effectiveAlt = currentDbAlt !== undefined ? currentDbAlt : (img.alt || "").trim();
      const isMissing = !effectiveAlt;
      const isGeneric = !isMissing && isGenericAlt(effectiveAlt);

      if (isMissing || isGeneric) {
        push(
          {
            route,
            issueType: "image_alt",
            title: isMissing ? "Image without alt text" : `Generic image alt ("${effectiveAlt}")`,
            detail: `Image "${img.src.split("/").pop() || img.src}". Keep descriptive alt text for accessibility and Google SEO.`,
            currentValue: effectiveAlt || null,
            imageSrc: img.src,
            actions: ["auto_fix"],
          },
          false
        );
      } else if (currentDbAlt) {
        push(
          {
            route,
            issueType: "image_alt",
            title: "Image alt text updated",
            detail: `Image "${img.src.split("/").pop() || img.src}". Alt text updated in database.`,
            currentValue: currentDbAlt,
            imageSrc: img.src,
            actions: ["auto_fix"],
          },
          true
        );
      }
    }
  }

  // Dead internal links found by the link checker (a redirect is the fix)
  const statuses = linkStatusesFromList(snap.linkChecks);
  if (statuses) {
    const known = new Set(crawls.map((c) => pathOfUrl(c.requestedPath || "/")));
    for (const [href, st] of Object.entries(statuses)) {
      if (!isBrokenLink(st)) continue;
      let u: URL;
      try {
        u = new URL(href);
      } catch {
        continue;
      }
      if (u.hostname.replace(/^www\./, "") !== new URL(origin).hostname.replace(/^www\./, "")) continue;
      const route = u.pathname.replace(/\/+$/, "") || "/";
      // /cdn-cgi/ is Cloudflare's own path (email protection and the like): it is not a page of this site and cannot be redirected from here
      if (known.has(route) || /\.[a-z0-9]{2,5}$/i.test(route) || route.startsWith("/cdn-cgi/")) continue;
      possible += WEIGHT.redirect;
      push(
        { route, issueType: "redirect", title: `Broken internal link (${st.status ?? st.error ?? "no response"})`, detail: `${route} is linked from the site but does not load.`, currentValue: String(st.status ?? ""), actions: ["redirect"] },
        fixed.has(`redirect::${normalizeFromPath(route)}`) && redirectFrom.has(normalizeFromPath(route))
      );
    }
  }

  const sev = { critical: 0, warning: 0, notice: 0 };
  for (const p of pending) sev[p.severity] += 1;
  const sorted = pending.sort((a, b) => ({ critical: 0, warning: 1, notice: 2 }[a.severity] - { critical: 0, warning: 1, notice: 2 }[b.severity]));

  return {
    hasAudit: true,
    snapshotAt: snap.createdAt ? new Date(snap.createdAt).toISOString() : null,
    reportScore: typeof snap.report?.seoScore === "number" ? snap.report.seoScore : null,
    healthScoreAtAudit: scoreFrom(pendingW + resolvedW, possible),
    healthScore: scoreFrom(pendingW, possible),
    pending: sorted.slice(0, MAX_LISTED),
    resolved: resolved.slice(0, MAX_LISTED),
    counts: { pending: pending.length, resolved: resolved.length, ...sev },
    truncated: pending.length > MAX_LISTED || resolved.length > MAX_LISTED,
  };
}

/** Number of successful, not-reverted fixes (for summaries). */
export async function countAppliedFixes(): Promise<number> {
  return SeoFixLog.countDocuments({ status: "applied", reverted: false });
}
