import type { CrawlResult } from "./crawler.service";
import { getSiteName, getSiteOrigin } from "../../config/seoSite";

/**
 * Rule-based findings for one crawled page, and the page score. Pure functions of the crawl: the same
 * crawl always gives the same answer, so the pages table, the page detail and the AI plan agree.
 */

export type RecommendationPriority = "high" | "medium" | "low";

export interface RecommendationItem {
  ruleId: string;
  category: string;
  priority: RecommendationPriority;
  title: string;
  whyItMatters: string;
  recommendedFix: string;
  implementation: string;
  suggestedTitle: string | null;
  suggestedDescription: string | null;
  headingSuggestions: string[];
  internalLinkSuggestions: Array<{ fromOrTo: string; anchorText: string; reason: string }>;
  contentSuggestions: string[];
  schemaSuggestion: string | null;
}

/** Same ranges the per-page SEO table uses, so a page flagged there is flagged here. Title and word limits are the ones Semrush uses, so both audits flag the same pages. */
export const TITLE_MIN = 10;
export const TITLE_MAX = 70;
export const DESC_MIN = 120;
export const DESC_MAX = 160;

/**
 * The one set of lengths the admin uses everywhere a title or meta description is judged or written: the Issues to fix
 * list, its AI fixes, and the report's Meta Title / Meta Description checks. (TITLE_MIN / TITLE_MAX above stay at the
 * Semrush limits for the "Compare audits" tool.) A title or description fixed from the list therefore passes the
 * report's check too.
 */
export const RECOMMENDED_TITLE = { min: 30, max: 70 } as const;
export const RECOMMENDED_DESC = { min: DESC_MIN, max: DESC_MAX } as const;

const SLOW_TTFB_MS = 800;
export const THIN_WORDS = 200;
const FEW_INTERNAL_LINKS = 3;

export const item = (partial: Partial<RecommendationItem> & Pick<RecommendationItem, "ruleId" | "category" | "priority" | "title" | "whyItMatters" | "recommendedFix" | "implementation">): RecommendationItem => ({
  suggestedTitle: null,
  suggestedDescription: null,
  headingSuggestions: [],
  internalLinkSuggestions: [],
  contentSuggestions: [],
  schemaSuggestion: null,
  ...partial,
});

const PRIORITY_ORDER: Record<RecommendationPriority, number> = { high: 0, medium: 1, low: 2 };

/** Rule-based findings for one crawled page. Pure: the same crawl always gives the same result. */
export function pageFindings(crawl: CrawlResult): { items: RecommendationItem[]; positives: string[] } {
  const items: RecommendationItem[] = [];
  const positives: string[] = [];
  const route = crawl.requestedPath;
  const title = (crawl.title || "").trim();
  const desc = (crawl.metaDescription || "").trim();

  if (!crawl.ok) {
    items.push(
      item({
        ruleId: "page_unreachable",
        category: "Indexability & Crawl",
        priority: "high",
        title: `The page ${route} could not be fetched`,
        whyItMatters: "A page search engines cannot fetch cannot be indexed or ranked.",
        recommendedFix: `The crawler got ${crawl.httpStatus ? `HTTP ${crawl.httpStatus}` : "no response"}${crawl.error ? ` (${crawl.error})` : ""}. Fix the route so it returns 200, or remove it from the sitemap.`,
        implementation: `Expected: HTTP 200 for ${crawl.url}`,
      }),
    );
    return { items, positives };
  }

  positives.push(`[HTTP] The page returned ${crawl.httpStatus} over ${crawl.httpVersion || "HTTP"}.`);

  // Title
  if (!title) {
    items.push(
      item({
        ruleId: "title_tag",
        category: "Title Tag",
        priority: "high",
        title: "Add a title tag",
        whyItMatters: "The title is the headline shown in search results and the strongest on-page ranking signal.",
        recommendedFix: `Add a unique <title> of ${TITLE_MIN}-${TITLE_MAX} characters that leads with what this page is about.`,
        implementation: "<title>Primary topic | Brand</title>",
      }),
    );
  } else if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    items.push(
      item({
        ruleId: "title_tag",
        category: "Title Tag",
        priority: "medium",
        title: title.length < TITLE_MIN ? "Lengthen the title tag" : "Shorten the title tag",
        whyItMatters: `The title is ${title.length} characters. Titles outside ${TITLE_MIN}-${TITLE_MAX} characters are either too thin to describe the page or get cut off in search results.`,
        recommendedFix: `Rewrite it to ${TITLE_MIN}-${TITLE_MAX} characters, putting the main topic first. Current: "${title}"`,
        implementation: `<title>${title.slice(0, TITLE_MAX)}</title>`,
      }),
    );
  } else {
    positives.push(`[Title] "${title}" is ${title.length} characters, inside the ${TITLE_MIN}-${TITLE_MAX} target.`);
  }

  // Meta description
  if (!desc) {
    items.push(
      item({
        ruleId: "meta_description",
        category: "Meta Description",
        priority: "high",
        title: "Add a meta description",
        whyItMatters: "Without one, search engines pick a random snippet of the page, which usually earns fewer clicks.",
        recommendedFix: `Write a ${DESC_MIN}-${DESC_MAX} character summary that says what the visitor gets and ends with a call to action.`,
        implementation: '<meta name="description" content="..." />',
      }),
    );
  } else if (desc.length < DESC_MIN || desc.length > DESC_MAX) {
    items.push(
      item({
        ruleId: "meta_description",
        category: "Meta Description",
        priority: "medium",
        title: desc.length < DESC_MIN ? "Expand the meta description" : "Shorten the meta description",
        whyItMatters: `The description is ${desc.length} characters; the useful range is ${DESC_MIN}-${DESC_MAX}.`,
        recommendedFix: `Rewrite it to ${DESC_MIN}-${DESC_MAX} characters with the key benefit and a call to action.`,
        implementation: `<meta name="description" content="${desc.slice(0, DESC_MAX).replace(/"/g, "&quot;")}" />`,
      }),
    );
  } else {
    positives.push(`[Description] The meta description is ${desc.length} characters, inside the ${DESC_MIN}-${DESC_MAX} target.`);
  }

  // Headings
  if (crawl.h1.length === 0) {
    items.push(
      item({
        ruleId: "heading_h1",
        category: "Headings",
        priority: "high",
        title: "Add an H1 heading",
        whyItMatters: "The H1 tells readers and crawlers what the page is about.",
        recommendedFix: "Add exactly one <h1> that names the page's main topic, and use <h2>/<h3> for the sections under it.",
        implementation: `<h1>${title || "Main topic of this page"}</h1>`,
      }),
    );
  } else if (crawl.h1.length > 1) {
    items.push(
      item({
        ruleId: "heading_h1",
        category: "Headings",
        priority: "medium",
        title: `Reduce the ${crawl.h1.length} H1 headings to one`,
        whyItMatters: "Several H1s dilute the page's main topic and make the outline harder to read.",
        recommendedFix: `Keep one H1 and turn the others into H2s. Found: ${crawl.h1.slice(0, 4).map((h) => `"${h}"`).join(", ")}`,
        implementation: "<h1>One main heading</h1>\n<h2>Section heading</h2>",
      }),
    );
  } else {
    positives.push("[Headings] The page has exactly one H1.");
  }

  // Indexability & canonical
  if (!crawl.indexable) {
    items.push(
      item({
        ruleId: "indexability",
        category: "Indexability & Crawl",
        priority: "high",
        title: "The page is blocked from search results",
        whyItMatters: "A noindex directive keeps this page out of Google completely.",
        recommendedFix: `Robots meta is "${crawl.robotsMeta || "noindex"}". Remove noindex if this page should be found in search.`,
        implementation: '<meta name="robots" content="index,follow" />',
      }),
    );
  } else {
    positives.push("[Indexability] No noindex directive; the page can be indexed.");
  }
  if (crawl.canonicalStatus === "missing") {
    items.push(
      item({
        ruleId: "canonical",
        category: "Canonical",
        priority: "medium",
        title: "Add a canonical link",
        whyItMatters: "A canonical URL tells search engines which address is the official one when the page is reachable in several ways.",
        recommendedFix: "Add a self-referencing canonical tag in the page head.",
        implementation: `<link rel="canonical" href="${crawl.url}" />`,
      }),
    );
  } else if (crawl.canonicalStatus === "points_elsewhere") {
    items.push(
      item({
        ruleId: "canonical",
        category: "Canonical",
        priority: "high",
        title: "The canonical link points to a different page",
        whyItMatters: "Search engines will treat the other address as the main page and may drop this one.",
        recommendedFix: `The canonical is ${crawl.canonical}. If this page should rank itself, point the canonical at ${crawl.url}.`,
        implementation: `<link rel="canonical" href="${crawl.url}" />`,
      }),
    );
  } else {
    positives.push("[Canonical] A self-referencing canonical link is set.");
  }

  // Structured data
  if (crawl.jsonLdBlocks === 0) {
    items.push(
      item({
        ruleId: "structured_data",
        category: "Structured Data (Schema.org)",
        priority: "medium",
        title: "Add structured data (JSON-LD)",
        whyItMatters: "Schema.org markup lets search engines understand the business and can unlock rich results.",
        recommendedFix: route === "/" ? "Add Organization and WebSite JSON-LD to the home page." : "Add JSON-LD that matches the page (for example WebPage with a BreadcrumbList, or Service).",
        implementation: `<script type="application/ld+json">{"@context":"https://schema.org","@type":"${route === "/" ? "Organization" : "WebPage"}","name":"${title || getSiteName()}","url":"${crawl.url}"}</script>`,
        schemaSuggestion: route === "/" ? "Organization" : "WebPage",
      }),
    );
  } else if (!crawl.jsonLdValid) {
    items.push(
      item({
        ruleId: "structured_data",
        category: "Structured Data (Schema.org)",
        priority: "high",
        title: "Fix the invalid JSON-LD",
        whyItMatters: "Markup that does not parse is ignored by search engines.",
        recommendedFix: `The JSON-LD on this page does not parse${crawl.jsonLdError ? `: ${crawl.jsonLdError}` : ""}. Validate it and correct the syntax.`,
        implementation: "Validate at https://validator.schema.org",
      }),
    );
  } else {
    positives.push(`[Structured data] Valid JSON-LD found (${crawl.jsonLdTypes.join(", ") || "no @type"}).`);
  }

  // Social cards
  const og = crawl.openGraph ?? {};
  const hasOg = Boolean(og["og:title"] && og["og:image"]);
  if (!hasOg) {
    items.push(
      item({
        ruleId: "social_cards",
        category: "Open Graph & Social Cards",
        priority: "low",
        title: "Complete the Open Graph tags",
        whyItMatters: "Links shared on WhatsApp, Facebook and LinkedIn use these tags for their preview card.",
        recommendedFix: `Missing: ${[!og["og:title"] && "og:title", !og["og:image"] && "og:image"].filter(Boolean).join(", ")}. Add them with a 1200x630 image.`,
        implementation: `<meta property="og:title" content="${title || getSiteName()}" />\n<meta property="og:image" content="${getSiteOrigin()}/path-to-share-image.jpg" />`,
      }),
    );
  } else {
    positives.push("[Social] Open Graph title and image are set.");
  }

  // Images
  if (crawl.imagesMissingAlt.length > 0) {
    items.push(
      item({
        ruleId: "image_alt",
        category: "Images",
        priority: "medium",
        title: `Add alt text to ${crawl.imagesMissingAlt.length} image(s)`,
        whyItMatters: "Alt text is read by screen readers and used by image search.",
        recommendedFix: `Describe each image in a few words. First affected: ${crawl.imagesMissingAlt.slice(0, 3).join(", ")}`,
        implementation: '<img src="..." alt="What the image shows" />',
      }),
    );
  } else if (crawl.images.length > 0) {
    positives.push(`[Images] All ${crawl.images.length} image(s) have alt text.`);
  }
  if (crawl.imagesMissingDims.length > 0) {
    items.push(
      item({
        ruleId: "image_dimensions",
        category: "Core Web Vitals",
        priority: "low",
        title: `Set width and height on ${crawl.imagesMissingDims.length} image(s)`,
        whyItMatters: "Images without dimensions make the page jump while loading (layout shift).",
        recommendedFix: "Declare width and height attributes, or an aspect-ratio in CSS, on every image.",
        implementation: '<img src="..." width="800" height="600" alt="..." />',
      }),
    );
  }

  // Content depth & links
  if (crawl.wordCount < THIN_WORDS) {
    items.push(
      item({
        ruleId: "content_depth",
        category: "Content",
        priority: "medium",
        title: `Expand the content (only ${crawl.wordCount} words)`,
        whyItMatters: `Pages under ${THIN_WORDS} words rarely give enough context to rank for more than a few terms.`,
        recommendedFix: "Add the information a visitor needs to decide: what is offered, how it works, who it is for, and common questions.",
        implementation: "Add sections with <h2> headings and short paragraphs.",
        contentSuggestions: ["Add an FAQ block", "Explain the process step by step", "Add a clear call to action"],
      }),
    );
  } else {
    positives.push(`[Content] ${crawl.wordCount} words of indexable text.`);
  }
  if (crawl.internalLinksUnique < FEW_INTERNAL_LINKS && route !== "/") {
    items.push(
      item({
        ruleId: "internal_links",
        category: "Internal Linking",
        priority: "low",
        title: `Link to more pages (only ${crawl.internalLinksUnique} internal link(s))`,
        whyItMatters: "Internal links help visitors move on and pass ranking strength to related pages.",
        recommendedFix: "Link to 2-3 related pages from the body text with descriptive anchor text.",
        implementation: '<a href="/related-page">descriptive anchor text</a>',
      }),
    );
  }

  // Speed
  if (crawl.ttfbMs > SLOW_TTFB_MS) {
    items.push(
      item({
        ruleId: "server_response",
        category: "Speed",
        priority: crawl.ttfbMs > 1800 ? "high" : "medium",
        title: `Speed up the server response (${crawl.ttfbMs} ms)`,
        whyItMatters: "A slow first byte delays everything else on the page and hurts Core Web Vitals.",
        recommendedFix: `The server took ${crawl.ttfbMs} ms to start responding (target under ${SLOW_TTFB_MS} ms). Add caching or a CDN, or look at slow database calls behind this page.`,
        implementation: "Cache-Control: public, max-age=300, stale-while-revalidate=60",
      }),
    );
  } else {
    positives.push(`[Speed] The server started responding in ${crawl.ttfbMs} ms.`);
  }

  items.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  return { items, positives };
}

/**
 * 0-100 page score: how many of 9 basic checks the page passes (reachable counts double). The same number
 * is shown in the pages table, the page detail and the AI plan.
 */
export const SCORE_CHECKS: Array<{ category: string; weight: number; passes: (crawl: CrawlResult) => boolean }> = [
  { category: "Page loads (HTTP 200)", weight: 2, passes: (c) => c.ok },
  { category: "Title length", weight: 1, passes: (c) => c.titleLength >= TITLE_MIN && c.titleLength <= TITLE_MAX },
  { category: "Meta description length", weight: 1, passes: (c) => c.descriptionLength >= DESC_MIN && c.descriptionLength <= DESC_MAX },
  { category: "Exactly one H1", weight: 1, passes: (c) => c.h1.length === 1 },
  { category: "Self-referencing canonical", weight: 1, passes: (c) => c.canonicalStatus === "self" },
  { category: "Images have alt text", weight: 1, passes: (c) => c.imagesMissingAlt.length === 0 },
  { category: "Mobile viewport tag", weight: 1, passes: (c) => Boolean(c.viewport) },
  { category: "Valid structured data", weight: 1, passes: (c) => c.jsonLdBlocks > 0 && c.jsonLdValid },
];
const SCORE_TOTAL_WEIGHT = SCORE_CHECKS.reduce((sum, check) => sum + check.weight, 0);

export function computeRouteScore(crawl: CrawlResult): number {
  const earned = SCORE_CHECKS.reduce((sum, check) => sum + (check.passes(crawl) ? check.weight : 0), 0);
  return Math.min(99, Math.max(0, Math.round((earned / SCORE_TOTAL_WEIGHT) * 100)));
}
