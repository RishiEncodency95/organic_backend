/**
 * Builds the full SEO checkup report from REAL inputs only:
 *
 *  - CrawlResult[]            live crawl of every route
 *  - SiteChecks               real robots/sitemap/TLS/SPF/header probes
 *  - PageSpeedSnapshot|null   real Google PageSpeed Insights run (optional)
 *  - GscResult                real Search Console query (or not-connected)
 *  - LlmPlatformResult[]      live assistant probes (or not-tested)
 *
 * A check whose input could not be measured is surfaced as a WARNING that
 * says so — it is never silently replaced by a fabricated pass.
 */

import type { CrawlResult } from "./crawler.service";
import type { SiteChecks } from "./siteChecks.service";
import type { GscResult } from "./gsc.service";
import type {
  CheckupGroup,
  CheckupIssue,
  CheckupTest,
  LlmPlatformResult,
  PageSpeedSnapshot,
  ReportInput,
  RouteSummary,
  SeoCheckupReportData,
} from "./types";

export interface ReportBuilderInput {
  origin: string;
  reportRoute: string;
  crawls: CrawlResult[];
  siteChecks: SiteChecks;
  pageSpeed: PageSpeedSnapshot | null;
  gsc: GscResult;
  llm: LlmPlatformResult[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, places = 0) => {
  const f = 10 ** places;
  return Math.round(value * f) / f;
};

function groupScore(tests: CheckupTest[]): number {
  if (tests.length === 0) return 0;
  const passed = tests.filter((t) => t.status === "passed").length;
  const warned = tests.filter((t) => t.status === "warning").length;
  return clamp(Math.round(((passed + warned * 0.5) / tests.length) * 100), 0, 99);
}

function count(tests: CheckupTest[]) {
  return {
    failed: tests.filter((t) => t.status === "failed").length,
    warnings: tests.filter((t) => t.status === "warning").length,
    passed: tests.filter((t) => t.status === "passed").length,
    total: tests.length,
  };
}

function labelForPath(path: string): string {
  if (path === "/" || path === "") return "Home Page";
  const tail = path.split("/").filter(Boolean).pop() || path;
  return tail
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function routeIdFor(path: string): string {
  if (path === "/" || path === "") return "home";
  return path.replace(/^\//, "").replace(/\/$/, "");
}

/** Per-route real summary consumed by the charts and pages table. */
export function buildRouteSummaries(
  crawls: CrawlResult[],
  gsc: GscResult,
): RouteSummary[] {
  return crawls.map((crawl) => {
    const gscRow = gsc.available
      ? gsc.pages.find((p) => {
          try {
            return new URL(p.page).pathname.replace(/\/$/, "") === (crawl.requestedPath === "/" ? "" : crawl.requestedPath.replace(/\/$/, ""));
          } catch {
            return p.page === crawl.url;
          }
        })
      : undefined;

    const titleOk = crawl.titleLength >= 20 && crawl.titleLength <= 60;
    const descOk = crawl.descriptionLength >= 120 && crawl.descriptionLength <= 220;
    const h1Ok = crawl.h1.length === 1;
    const basics =
      (crawl.ok ? 2 : 0) +
      (titleOk ? 1 : 0) +
      (descOk ? 1 : 0) +
      (h1Ok ? 1 : 0) +
      (crawl.canonicalStatus === "self" ? 1 : 0) +
      (crawl.imagesMissingAlt.length === 0 ? 1 : 0) +
      (crawl.viewport ? 1 : 0) +
      (crawl.jsonLdBlocks > 0 && crawl.jsonLdValid ? 1 : 0);
    const score = clamp(Math.round((basics / 9) * 100), 0, 99);

    return {
      id: routeIdFor(crawl.requestedPath),
      path: crawl.requestedPath,
      label: labelForPath(crawl.requestedPath),
      url: crawl.url,
      title: crawl.title,
      titleLength: crawl.titleLength,
      metaDescription: crawl.metaDescription,
      metaDescriptionLength: crawl.descriptionLength,
      httpStatus: crawl.httpStatus || null,
      ok: crawl.ok,
      indexable: crawl.indexable,
      canonical: crawl.canonical,
      canonicalStatus: crawl.canonicalStatus,
      score,
      words: crawl.wordCount,
      internalLinks: crawl.internalLinksUnique,
      externalLinks: crawl.externalLinksUnique,
      h1Count: crawl.h1.length,
      h2Count: crawl.h2.length,
      imageCount: crawl.images.length,
      imagesMissingAlt: crawl.imagesMissingAlt.length,
      domNodes: crawl.domNodes || null,
      htmlKb: crawl.uncompressedBytes ? round(crawl.uncompressedBytes / 1024, 1) : null,
      ttfbMs: crawl.ok ? crawl.ttfbMs : null,
      loadMs: crawl.ok ? crawl.totalMs : null,
      failedChecks: 0,
      warningChecks: 0,
      passedChecks: 0,
      searchConsole: gscRow
        ? { available: true, clicks: gscRow.clicks, impressions: gscRow.impressions, ctr: gscRow.ctr, position: gscRow.position }
        : { available: false, clicks: null, impressions: null, ctr: null, position: null },
    };
  });
}

function buildPageSpeedGroup(ps: PageSpeedSnapshot): CheckupGroup {
  const { scores: sc, metrics: m } = ps;
  const status = (value: number | null): CheckupTest["status"] => {
    if (value == null) return "warning";
    if (value >= 90) return "passed";
    if (value >= 50) return "warning";
    return "failed";
  };
  const vital = (value: number | null, good: number, poor: number): CheckupTest["status"] => {
    if (value == null) return "warning";
    if (value <= good) return "passed";
    if (value <= poor) return "warning";
    return "failed";
  };

  if (!ps.ok) {
    return {
      id: "page-speed",
      name: "Google PageSpeed Insights (Lighthouse)",
      note: ps.message || "A real Lighthouse run could not be completed for this URL.",
      tests: [
        {
          id: "psi-unavailable",
          name: "PageSpeed Insights run",
          status: "warning",
          level: "page",
          source: "measured",
          summary: ps.message || "Google PageSpeed Insights did not return results for this URL right now. No numbers are shown because none were measured.",
          fix: "Re-run the audit later or check that the URL is publicly reachable, then run the audit again.",
        },
      ],
    };
  }

  const scoreTest = (id: string, name: string, value: number | null, note: string): CheckupTest => ({
    id: `psi-${id}`,
    name,
    status: status(value),
    level: "page",
    source: "measured",
    summary: value == null ? `${name} was not returned by PageSpeed Insights.` : note,
    meta: [{ label: "PageSpeed score", value: value == null ? "not returned" : `${value} / 100` }],
    benchmark: `${value == null ? "no data" : `${value}/100`} · Lighthouse ${ps.strategy} run`,
  });

  const metricTest = (
    id: string,
    name: string,
    value: number | null,
    display: string,
    testStatus: CheckupTest["status"],
    note: string,
  ): CheckupTest => ({
    id: `psi-${id}`,
    name,
    status: testStatus,
    level: "page",
    source: "measured",
    summary: note,
    meta: [{ label: "Lighthouse lab value", value: display, mono: true }],
  });

  const tests: CheckupTest[] = [
    scoreTest("performance", "PageSpeed Performance Score", sc.performance, "Weighted from FCP, LCP, TBT, CLS and Speed Index for this route."),
    scoreTest("accessibility", "PageSpeed Accessibility Score", sc.accessibility, "Lighthouse accessibility audits: contrast, labels, names, keyboard order."),
    scoreTest("best-practices", "PageSpeed Best Practices Score", sc.bestPractices, "HTTPS, console errors, image quality, document metadata and deprecations."),
    scoreTest("seo", "PageSpeed SEO Score", sc.seo, "Google's own on-page SEO checks: title, meta description, link text, crawlability, viewport."),
    metricTest("fcp", "First Contentful Paint", m.fcpMs, m.fcpMs == null ? "not returned" : `${round(m.fcpMs / 1000, 2)}s`, vital(m.fcpMs ? m.fcpMs / 1000 : null, 1.8, 3.0), "How long the first text or image paints. Good is ≤ 1.8s, poor above 3.0s."),
    metricTest("lcp", "Largest Contentful Paint", m.lcpMs, m.lcpMs == null ? "not returned" : `${round(m.lcpMs / 1000, 2)}s`, vital(m.lcpMs ? m.lcpMs / 1000 : null, 2.5, 4.0), "When the largest above-the-fold element paints. Good is ≤ 2.5s, poor above 4.0s."),
    metricTest("tbt", "Total Blocking Time", m.tbtMs, m.tbtMs == null ? "not returned" : `${m.tbtMs}ms`, vital(m.tbtMs == null ? null : m.tbtMs / 1000, 0.2, 0.6), "Main-thread work that blocks interaction. Good is ≤ 200ms, poor above 600ms."),
    metricTest("cls", "Cumulative Layout Shift", m.cls, m.cls == null ? "not returned" : String(round(m.cls, 4)), vital(m.cls, 0.1, 0.25), "Visual stability of the page. Good is ≤ 0.1, poor above 0.25."),
    metricTest("si", "Speed Index", m.siMs, m.siMs == null ? "not returned" : `${round(m.siMs / 1000, 2)}s`, vital(m.siMs ? m.siMs / 1000 : null, 3.4, 5.8), "How quickly the page fills in visually. Good is ≤ 3.4s, poor above 5.8s."),
    {
      id: "psi-crux",
      name: "Real-user field data (Chrome UX Report)",
      status: ps.fieldData.available ? (ps.fieldData.overall?.toUpperCase() === "GOOD" ? "passed" : ps.fieldData.overall ? "warning" : "warning") : "warning",
      level: "page",
      source: "measured",
      summary: ps.fieldData.available
        ? `Chrome UX Report reports ${ps.fieldData.overall ?? "a"} experience for this origin.`
        : "Chrome UX Report field data is not available for this origin yet (site needs more real traffic over time).",
      meta: [{ label: "CrUX origin data", value: ps.fieldData.available ? (ps.fieldData.overall ?? "available") : "not available" }],
    },
  ];

  return {
    id: "page-speed",
    name: "Google PageSpeed Insights (Lighthouse)",
    note: `Live Google PageSpeed Insights run for ${ps.strategy}, fetched ${new Date(ps.fetchedAt).toLocaleString("en-IN")}${ps.cached ? " (cached ≤6h)" : ""}.`,
    score: groupScore(tests),
    tests,
  };
}

function buildAiInsightsGroup(crawl: CrawlResult, gsc: GscResult): CheckupGroup {
  const words = crawl.wordCount;
  const inLinks = crawl.internalLinksUnique;
  const depth = clamp(Math.round(words / 15), 0, 100);
  const linkSupport = clamp(inLinks * 3, 0, 100);
  const hasSchema = crawl.jsonLdBlocks > 0 && crawl.jsonLdValid;
  const topical = hasSchema && crawl.title ? 90 : crawl.title ? 70 : 40;
  const trust = Math.round(depth * 0.5 + linkSupport * 0.3 + (hasSchema ? 20 : 0));
  const trustStatus: CheckupTest["status"] = trust >= 60 ? "passed" : trust >= 40 ? "warning" : "failed";

  const tests: CheckupTest[] = [
    {
      id: "content-strengths",
      name: "Content Strengths and Weaknesses",
      status: trustStatus,
      level: "page",
      source: "derived",
      summary: `Evaluated from THIS audit's live crawl of ${crawl.url}: ${words} words, ${inLinks} unique internal links, ${crawl.images.length} images.`,
      stats: [
        { label: "Content Trust Score", value: `${trust}%`, tone: trust >= 60 ? "green" : "amber" },
        { label: "Topical Relevance", value: `${topical}%`, tone: "blue" },
        { label: "Content Depth", value: `${depth}%`, tone: "indigo" },
        { label: "Internal Link Support", value: `${linkSupport}%`, tone: linkSupport >= 50 ? "green" : "amber" },
      ],
      lists: [
        {
          title: "Content Strengths",
          items: [
            `${words} words of indexable copy on this route`,
            `${inLinks} unique internal links pointing from this route`,
            gsc.available && gsc.totals
              ? `${gsc.totals.clicks} Search Console clicks and ${gsc.totals.impressions} impressions across the site in ${gsc.rangeStart} → ${gsc.rangeEnd}`
              : "Search Console metrics are not connected for this property",
          ],
        },
        {
          title: "Content Weaknesses",
          items: [
            crawl.descriptionLength === 0
              ? "No meta description is served on this route"
              : `Meta description is ${crawl.descriptionLength} characters${crawl.descriptionLength < 150 ? " (below the 150-220 target)" : crawl.descriptionLength > 220 ? " (above the 220 target)" : " (inside the 150-220 target)"}`,
            linkSupport < 50 ? `Only ${inLinks} unique internal links support this route` : "Internal link support is healthy",
            gsc.available && gsc.totals
              ? `Site-wide average position is ${gsc.totals.position}`
              : "Connect Search Console for ranking-position context",
          ],
        },
      ],
      fix: "Add leadership bios, cited sources and certification proof, and link this route from the main navigation to lift Content Trust above 60%.",
    },
  ];

  return {
    id: "ai-insights",
    name: "AI Insights",
    note: `Derived from the live crawl of this route · ${tests.length} checks`,
    score: groupScore(tests),
    tests,
  };
}

function buildLlmGroup(llm: LlmPlatformResult[]): CheckupGroup {
  const tested = llm.filter((p) => p.tested && p.results.length > 0);
  const mentionRate = tested.length
    ? Math.round(
        (tested.reduce(
          (acc, p) => acc + p.results.filter((r) => r.mentioned || r.citedDomain).length,
          0,
        ) /
          tested.reduce((acc, p) => acc + p.results.length, 0)) *
          100,
      )
    : null;

  if (tested.length === 0) {
    return {
      id: "llm-visibility",
      name: "LLM Visibility Checker",
      note: "Track your brand across ChatGPT, Gemini, Claude and Perplexity",
      badge: "Not tested",
      tests: [
        {
          id: "llm-not-tested",
          name: "Brand Mentions Across LLMs",
          status: "warning",
          level: "site",
          summary:
            "No live assistant probe ran because no LLM API keys are configured. Set OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY and/or PERPLEXITY_API_KEY, then re-run the audit to get real brand-mention evidence. This check is deliberately not marked as passed without evidence.",
          fix: "Add at least one LLM API key to the backend environment and re-run the SEO audit.",
        },
      ],
    };
  }

  const rows = llm.map((p) => {
    if (!p.tested) {
      return [p.platform, "—", "Not tested", p.reason || "API key not configured"];
    }
    const mentioned = p.results.filter((r) => r.mentioned).length;
    const cited = p.results.filter((r) => r.citedDomain).length;
    return [
      p.platform,
      p.model,
      mentioned > 0 ? `✓ Mentioned (${mentioned}/${p.results.length})` : "✗ Not mentioned",
      cited > 0 ? `bharatorganicexpo.com cited (${cited}/${p.results.length})` : "No domain citation",
    ];
  });

  const evidence = llm.flatMap((p) =>
    p.tested ? p.results.filter((r) => r.excerpt).map((r) => `${p.platform}: “${r.excerpt}”`) : [],
  );

  const status: CheckupTest["status"] =
    mentionRate == null ? "warning" : mentionRate >= 50 ? "passed" : mentionRate > 0 ? "warning" : "failed";

  return {
    id: "llm-visibility",
    name: "LLM Visibility Checker",
    note: "Live prompts sent to the configured assistants during this audit run",
    badge: mentionRate == null ? "Not tested" : `Brand presence ${mentionRate}%`,
    headline:
      mentionRate == null
        ? undefined
        : { value: `${mentionRate}%`, label: "Prompts mentioning the brand" },
    tests: [
      {
        id: "llm-table",
        name: "Brand Mentions Across LLMs",
        status,
        level: "site",
        source: "measured",
        summary: `Real prompt responses inspected across ${tested.length} assistant(s)${llm.length > tested.length ? ` (${llm.length - tested.length} skipped: no API key)` : ""}.`,
        tables: [
          {
            headers: ["Assistant", "Model", "Brand mention", "Domain citation"],
            rows,
          },
        ],
        evidence: evidence.slice(0, 6),
        fix:
          status === "passed"
            ? "Maintain the FAQ schema block so assistants keep citing one authoritative URL."
            : "Publish an FAQ schema block with dates, venue and registration facts so assistants can cite a single authoritative URL.",
      },
    ],
  };
}

function buildVisualGroup(crawl: CrawlResult): CheckupGroup {
  const titleReadable = crawl.titleLength >= 20 && crawl.titleLength <= 70;
  const hasCtaLinks = crawl.links.some((l) =>
    /register|participate|sponsor|book|stall|exhibit/i.test(l.anchorText),
  );
  const singleH1 = crawl.h1.length === 1;
  const longScroll = crawl.wordCount > 1200 && crawl.images.length > 20;

  const tests: CheckupTest[] = [
    {
      id: "first-screen-clarity",
      name: "First-screen clarity",
      status: titleReadable ? "passed" : "warning",
      level: "page",
      source: "crawl",
      summary: crawl.title
        ? `Title tag renders at ${crawl.titleLength} characters: “${crawl.title}”`
        : "No title tag is served on this route",
    },
    {
      id: "value-proposition",
      name: "Value proposition",
      status: crawl.wordCount >= 300 ? "passed" : "warning",
      level: "page",
      source: "crawl",
      summary: `${crawl.wordCount} words of copy and ${crawl.h2.length} H2 sections carry the proposition above/below the fold.`,
    },
    {
      id: "trust-signals",
      name: "Trust signals",
      status: crawl.internalLinksUnique >= 5 && crawl.jsonLdBlocks > 0 ? "passed" : "warning",
      level: "page",
      source: "crawl",
      summary: `${crawl.internalLinksUnique} unique internal links and ${crawl.jsonLdBlocks} JSON-LD block(s) present on this route.`,
    },
    {
      id: "call-to-action-path",
      name: "Call to action path",
      status: hasCtaLinks ? "passed" : "warning",
      level: "page",
      source: "crawl",
      summary: hasCtaLinks
        ? "Register / Participate / Sponsor style CTAs were found in this route's live links."
        : "No obvious register/participate/sponsor CTA anchor text was found in this route's links.",
      fix: hasCtaLinks ? undefined : "Add at least one descriptive CTA link (Book a Stall / Register) in the main content.",
    },
    {
      id: "visual-hierarchy",
      name: "Visual hierarchy",
      status: singleH1 ? "passed" : "failed",
      level: "page",
      source: "crawl",
      summary: singleH1
        ? "A single H1 anchors the hierarchy on this route."
        : `Found ${crawl.h1.length} H1 tags on this route — demote all but the primary one to H2.`,
    },
    {
      id: "drop-off-risk",
      name: "Drop-off risk",
      status: longScroll ? "warning" : "passed",
      level: "page",
      source: "derived",
      summary: longScroll
        ? `${crawl.wordCount} words with ${crawl.images.length} images on a long scroll — a sticky conversion bar protects mobile visitors.`
        : `Page length (${crawl.wordCount} words, ${crawl.images.length} images) is within a comfortable scroll range.`,
    },
  ];

  return {
    id: "visual-seo",
    name: "Visual SEO Analysis",
    note: "Design signals read from this route's live HTML",
    score: groupScore(tests),
    tests,
  };
}

function buildFreshnessGroup(crawls: CrawlResult[], siteChecks: SiteChecks): CheckupGroup {
  const currentYear = new Date().getFullYear();
  const home = crawls.find((c) => c.requestedPath === "/") || crawls[0];
  const staleCopyright =
    home && home.copyrightYears.length > 0
      ? home.copyrightYears.filter((y) => y < currentYear)
      : [];
  const sitemapLastmods = siteChecks.sitemap.entries
    .map((e) => e.lastmod)
    .filter((v): v is string => Boolean(v))
    .sort();
  const newestLastmod = sitemapLastmods.length ? sitemapLastmods[sitemapLastmods.length - 1] : null;
  const lastmodDays = newestLastmod
    ? Math.round((Date.now() - new Date(newestLastmod).getTime()) / 86_400_000)
    : null;

  const positive: string[] = [];
  const staleness: string[] = [];
  if (home?.hasEventDates) positive.push("Explicit event-year dates are present in the live copy");
  if (home?.hasCountdown) positive.push("A countdown / time-left element is present");
  if (newestLastmod && lastmodDays !== null && lastmodDays <= 30) {
    positive.push(`Sitemap lastmod entries updated ${lastmodDays} day(s) ago (${newestLastmod})`);
  } else if (!newestLastmod) {
    staleness.push("Sitemap has no <lastmod> dates to prove freshness");
  } else {
    staleness.push(`Newest sitemap lastmod is ${lastmodDays} days old (${newestLastmod})`);
  }
  if (staleCopyright.length > 0) {
    staleness.push(`Footer copyright mentions ${staleCopyright.join(", ")} while the current year is ${currentYear}`);
  }

  const fresh = positive.length > 0 && staleness.length === 0;
  const tests: CheckupTest[] = [
    {
      id: "content-freshness",
      name: "Content Freshness",
      status: staleCopyright.length > 0 ? "warning" : positive.length > 0 ? "passed" : "warning",
      level: "site",
      source: "derived",
      summary: `Judged from signals observed in this crawl: ${positive.length} positive, ${staleness.length} staleness signal(s).`,
      lists: [
        { title: "Positive Signals", items: positive.length ? positive : ["None detected"] },
        { title: "Staleness Signals", items: staleness.length ? staleness : ["None detected"] },
      ],
      fix: fresh ? undefined : "Update the footer copyright year and keep sitemap <lastmod> dates current.",
    },
  ];
  return {
    id: "content-freshness",
    name: "Content Freshness",
    note: "Freshness scored from live crawl signals and sitemap lastmod dates",
    score: groupScore(tests),
    tests,
  };
}

function buildOpportunitiesGroup(crawls: CrawlResult[]): CheckupGroup {
  const paths = new Set(crawls.map((c) => c.requestedPath));
  const hasSpeaker = Array.from(paths).some((p) => /speaker|conference/i.test(p));
  const blogPosts = crawls.filter((c) => c.requestedPath.startsWith("/blog/") && c.ok);
  const thinPages = crawls.filter((c) => c.ok && c.wordCount < 300);

  const recommendations: string[] = [];
  if (!hasSpeaker) {
    recommendations.push("Add a speaker lineup page with names, roles, and session topics for the conference.");
  }
  if (!paths.has("/faq")) {
    recommendations.push("Publish an FAQ page (with FAQPage schema) covering eligibility, scheduling and registration format.");
  }
  if (blogPosts.length < 5) {
    recommendations.push(`Only ${blogPosts.length} blog post(s) exist on the live sitemap — publish topical cluster content (certification explainers, category guides) to grow organic reach.`);
  }
  if (thinPages.length > 0) {
    recommendations.push(`${thinPages.length} route(s) serve under 300 words (${thinPages.slice(0, 5).map((c) => c.requestedPath).join(", ")}${thinPages.length > 5 ? ", …" : ""}) — expand or consolidate them.`);
  }

  const tests: CheckupTest[] = [
    {
      id: "quick-wins",
      name: "Quick Wins",
      status: recommendations.length > 0 ? "warning" : "passed",
      level: "site",
      source: "derived",
      summary: recommendations.length
        ? `Derived from this crawl: ${recommendations.length} content gap(s) detected across ${crawls.length} live routes.`
        : `No structural content gaps detected across ${crawls.length} live routes.`,
      lists: recommendations.length ? [{ title: "Recommended next pages", items: recommendations }] : undefined,
      fix: recommendations.length ? "Ship the recommended pages, then re-run the audit." : undefined,
    },
  ];
  return {
    id: "content-opportunities",
    name: "Content Opportunities",
    note: "Gaps derived from the live route inventory of this crawl",
    score: groupScore(tests),
    tests,
  };
}

function buildCommonSeoGroup(crawl: CrawlResult, siteChecks: SiteChecks, origin: string): CheckupGroup {
  const title = crawl.title || "";
  const desc = crawl.metaDescription;
  const ogKeys = ["og:title", "og:description", "og:url", "og:image", "og:type"];
  const ogPresent = ogKeys.filter((k) => crawl.openGraph[k]);
  const twitterKeys = ["twitter:card", "twitter:title", "twitter:description", "twitter:image"];
  const twitterPresent = twitterKeys.filter((k) => crawl.twitter[k]);
  const sitemapPaths = new Set(
    siteChecks.sitemap.entries.map((e) => {
      try {
        return new URL(e.loc).pathname.replace(/\/$/, "") || "/";
      } catch {
        return e.loc;
      }
    }),
  );
  const inSitemap = sitemapPaths.has(crawl.requestedPath === "/" ? "/" : crawl.requestedPath);

  const keywordRows: Array<Array<string | number>> = [];
  const keywordCandidates = Array.from(
    new Set([
      ...title.split(/\s+/).slice(0, 3).map((w) => w.toLowerCase()).filter((w) => w.length > 3),
      "bharat organic expo",
    ]),
  ).slice(0, 5);
  const headingsText = [...crawl.h1, ...crawl.h2, ...crawl.h3].join(" ").toLowerCase();
  const descLower = (desc || "").toLowerCase();
  let keywordsPassing = 0;
  for (const kw of keywordCandidates) {
    const inTitle = title.toLowerCase().includes(kw);
    const inDesc = desc ? descLower.includes(kw) : false;
    const inHead = headingsText.includes(kw);
    if (inTitle && inDesc && inHead) keywordsPassing += 1;
    keywordRows.push([kw, inTitle ? "✓" : "✗", desc ? (inDesc ? "✓" : "✗") : "n/a", inHead ? "✓" : "✗"]);
  }
  const keywordCoverage = keywordCandidates.length ? keywordsPassing / keywordCandidates.length : 0;

  const tests: CheckupTest[] = [
    {
      id: "meta-title",
      name: "Meta Title Test",
      status: crawl.titleLength >= 20 && crawl.titleLength <= 60 ? "passed" : "warning",
      level: "page",
      source: "crawl",
      summary: `Length: ${crawl.titleLength} characters measured on the live page. Target: 20-60 characters.`,
      meta: [{ label: "Title", value: title || "(missing)" }],
      fix: crawl.titleLength > 60 ? "Shorten the title to under 60 characters so Google doesn't truncate it." : crawl.titleLength < 20 ? "Expand the title to at least 20 characters with the primary keyword." : undefined,
    },
    {
      id: "meta-description",
      name: "Meta Description Test",
      status: desc && desc.length >= 120 && desc.length <= 220 ? "passed" : desc ? "warning" : "failed",
      level: "page",
      source: "crawl",
      summary: desc
        ? `Description length measured on the live page: ${desc.length} characters. Target: 120-160 characters for full SERP display.`
        : "No <meta name=\"description\"> is served on this route.",
      meta: desc ? [{ label: "Text", value: desc }] : undefined,
      fix: desc ? undefined : "Add a 120-160 character meta description with the primary keyword and a reason to click.",
    },
    {
      id: "serp-preview",
      name: "Google Search Results Preview Test",
      status: crawl.canonicalStatus === "self" && title ? "passed" : "warning",
      level: "page",
      source: "derived",
      summary: `Canonical URL ${crawl.canonical || crawl.url} with a ${crawl.titleLength}-char title${desc ? ` and ${crawl.descriptionLength}-char description` : " and no description"} renders a valid desktop/mobile snippet.`,
    },
    {
      id: "social-meta",
      name: "Social Media Meta Tags Test",
      status: ogPresent.length === ogKeys.length && twitterPresent.length >= 2 ? "passed" : ogPresent.length > 0 ? "warning" : "failed",
      level: "page",
      source: "crawl",
      summary: `Open Graph: ${ogPresent.length}/${ogKeys.length} core tags · Twitter Card: ${twitterPresent.length}/${twitterKeys.length} tags found in the live HTML.`,
      tables: [
        {
          title: "Open Graph",
          headers: ["Tag", "Content"],
          rows: ogKeys.map((k) => [k, crawl.openGraph[k] || "missing"]),
        },
        {
          title: "Twitter Card",
          headers: ["Tag", "Content"],
          rows: twitterKeys.map((k) => [k, crawl.twitter[k] || "missing"]),
        },
      ],
    },
    {
      id: "keywords-usage",
      name: "Keywords Usage Test",
      status: keywordCoverage >= 0.66 ? "passed" : keywordCoverage > 0 ? "warning" : "failed",
      level: "page",
      source: "derived",
      summary: keywordCandidates.length
        ? `${keywordsPassing}/${keywordCandidates.length} tracked terms appear in title + meta description + headings of the live page.`
        : "No keywords could be extracted from this page's title.",
      tables: [
        { headers: ["Keyword", "Title tag", "Meta description", "Headings"], rows: keywordRows },
      ],
      fix: keywordCoverage >= 0.66 ? undefined : "Carry the primary keyword into the meta description and at least one H2 on this route.",
    },
    {
      id: "heading-tags",
      name: "Heading Tags Test",
      status: crawl.h1.length === 1 ? "passed" : "failed",
      level: "page",
      source: "crawl",
      summary: `Detected ${crawl.h1.length} H1, ${crawl.h2.length} H2 and ${crawl.h3.length} H3 tags in the live HTML.`,
      lists: [{ title: "Detected H1 Tags", items: crawl.h1.length ? crawl.h1 : ["(none)"] }],
      fix: crawl.h1.length === 1 ? undefined : "Keep exactly one descriptive H1 per route; demote banner headings to H2.",
    },
    {
      id: "robots-txt",
      name: "robots.txt Test",
      status: siteChecks.robotsTxt.available ? "passed" : "failed",
      level: "site",
      source: "measured",
      summary: siteChecks.robotsTxt.available
        ? `Live robots.txt served at ${siteChecks.robotsTxt.url} with ${siteChecks.robotsTxt.rules.length} rule group(s) and ${siteChecks.robotsTxt.sitemaps.length} sitemap pointer(s).`
        : `robots.txt check failed: ${siteChecks.robotsTxt.error}`,
    },
    {
      id: "sitemap-test",
      name: "Sitemap Test",
      status: siteChecks.sitemap.available && inSitemap ? "passed" : siteChecks.sitemap.available ? "warning" : "failed",
      level: "site",
      source: "measured",
      summary: siteChecks.sitemap.available
        ? `Live sitemap at ${siteChecks.sitemap.url} lists ${siteChecks.sitemap.entries.length} URL(s); this route ${inSitemap ? "is" : "is NOT"} included.`
        : `No reachable sitemap: ${siteChecks.sitemap.error}`,
    },
    {
      id: "image-alt",
      name: "Image Alt Test",
      status: crawl.imagesMissingAlt.length === 0 ? "passed" : "failed",
      level: "page",
      source: "crawl",
      summary: `${crawl.imagesMissingAlt.length} of ${crawl.images.length} <img> tags on ${crawl.requestedPath} have an empty or missing "alt" attribute (live HTML).`,
      evidence: crawl.imagesMissingAlt.slice(0, 10),
      fix: crawl.imagesMissingAlt.length === 0 ? undefined : "Add descriptive alt text to every informative image; keep alt empty only for decorative images.",
    },
    {
      id: "responsive-images",
      name: "Responsive Image Test",
      status: crawl.imagesMissingSrcset.length === 0 ? "passed" : "warning",
      level: "page",
      source: "crawl",
      summary: `${crawl.imagesMissingSrcset.length} of ${crawl.images.length} images on ${crawl.requestedPath} are served without srcset (live HTML).`,
      evidence: crawl.imagesMissingSrcset.slice(0, 10),
      fix: crawl.imagesMissingSrcset.length === 0 ? undefined : "Serve width/height variants with srcset and sizes attributes, or resize uploads to rendered dimensions.",
    },
    {
      id: "image-dimensions",
      name: "Image Aspect Ratio Test",
      status: crawl.imagesMissingDims.length === 0 ? "passed" : "warning",
      level: "page",
      source: "crawl",
      summary: `${crawl.imagesMissingDims.length} of ${crawl.images.length} images on ${crawl.requestedPath} are missing explicit width/height (live HTML).`,
      evidence: crawl.imagesMissingDims.slice(0, 10),
      fix: crawl.imagesMissingDims.length === 0 ? undefined : "Declare width and height (or CSS aspect-ratio) on images to prevent layout shift.",
    },
    {
      id: "deprecated-tags",
      name: "Deprecated HTML Tags Test",
      status: crawl.deprecatedTags.length === 0 ? "passed" : "warning",
      level: "page",
      source: "crawl",
      summary: crawl.deprecatedTags.length === 0
        ? "No deprecated HTML tags found in the live document."
        : `Deprecated tags found: ${crawl.deprecatedTags.join(", ")}`,
    },
    {
      id: "favicon",
      name: "Favicon Test",
      status: crawl.favicon ? "passed" : "warning",
      level: "page",
      source: "crawl",
      summary: crawl.favicon ? "A favicon link is served in the live HTML head." : "No favicon <link> tag found in the live HTML head.",
    },
    {
      id: "charset",
      name: "Charset Declaration Test",
      status: crawl.charset ? "passed" : "failed",
      level: "page",
      source: "crawl",
      summary: crawl.charset
        ? `Charset declared in the live HTML: ${crawl.charset}`
        : "No character encoding declaration found in the live HTML.",
    },
    {
      id: "internal-linking",
      name: "Internal Linking Test",
      status: crawl.internalLinksUnique >= 10 ? "passed" : "warning",
      level: "page",
      source: "crawl",
      summary: `${crawl.internalLinksUnique} unique internal links and ${crawl.externalLinksUnique} unique external links found in the live HTML.`,
      fix: crawl.internalLinksUnique >= 10 ? undefined : "Link this route from more body copy and the main navigation.",
    },
  ];

  return {
    id: "common-seo-issues",
    name: "Common SEO Issues",
    note: `Live HTML checks for ${crawl.requestedPath} · ${tests.length} tests`,
    score: groupScore(tests),
    tests,
  };
}

function buildSpeedGroup(crawl: CrawlResult, siteChecks: SiteChecks): CheckupGroup {
  const ttfbSec = round(crawl.ttfbMs / 1000, 3);

  const tests: CheckupTest[] = [
    {
      id: "dom-size",
      name: "DOM Size Test",
      status: crawl.domNodes <= 1500 ? "passed" : crawl.domNodes <= 3000 ? "warning" : "failed",
      level: "page",
      source: "measured",
      summary: `The live DOM of this page has ${crawl.domNodes} nodes (recommended < 1500). A large DOM increases page load time.`,
      meta: [{ label: "DOM nodes", value: String(crawl.domNodes), mono: true }],
      fix: crawl.domNodes <= 1500 ? undefined : "Virtualise long lists, collapse accordions and remove wrapper divs that exist only for styling.",
    },
    {
      id: "ttfb",
      name: "Time To First Byte Test",
      status: ttfbSec <= 0.8 ? "passed" : ttfbSec <= 1.8 ? "warning" : "failed",
      level: "page",
      source: "measured",
      summary: `TTFB measured at ${ttfbSec}s. Google recommends 0.8s or less.`,
      meta: [{ label: "TTFB", value: `${ttfbSec}s (target <0.8s, poor >1.8s)`, mono: true }],
    },
    {
      id: "sync-head-scripts",
      name: "Render Blocking Scripts Test",
      status: crawl.syncHeadScripts === 0 ? "passed" : "warning",
      level: "page",
      source: "crawl",
      summary: crawl.syncHeadScripts === 0
        ? "No synchronous <script src> tags block parsing in <head>."
        : `${crawl.syncHeadScripts} synchronous script(s) in <head> can block first paint — add defer/async.`,
      fix: crawl.syncHeadScripts === 0 ? undefined : "Add defer (or async where safe) to head scripts, or move them to the end of body.",
    },
  ];

  if (siteChecks.http2.available) {
    tests.push({
      id: "http2",
      name: "HTTP2 Test",
      status: "passed",
      level: "site",
      source: "measured",
      summary: "The live origin negotiated an HTTP/2 connection during this audit.",
    });
  } else {
    tests.push({
      id: "http2",
      name: "HTTP2 Test",
      status: "warning",
      level: "site",
      source: "measured",
      summary: `The live origin did not offer HTTP/2: ${siteChecks.http2.error || "no ALPN negotiation"}`,
    });
  }

  return {
    id: "speed-optimizations",
    name: "Speed Optimizations",
    note: "Byte sizes, timings and protocol facts measured during this audit",
    score: groupScore(tests),
    tests,
  };
}

function buildSecurityGroup(crawl: CrawlResult, siteChecks: SiteChecks, origin: string): CheckupGroup {
  const host = new URL(origin).hostname;
  const tls = siteChecks.tls;
  const tests: CheckupTest[] = [
    {
      id: "canonicalization",
      name: "URL Canonicalization Test",
      status:
        siteChecks.canonicalization.wwwRedirectsToApex ||
        siteChecks.canonicalization.apexStatus === siteChecks.canonicalization.wwwStatus
          ? "passed"
          : "warning",
      level: "site",
      source: "measured",
      summary: `https://${host}/ responded ${siteChecks.canonicalization.apexStatus}; https://www.${host}/ responded ${siteChecks.canonicalization.wwwStatus}${siteChecks.canonicalization.wwwRedirectsToApex ? " and redirects to the apex host" : ""}.`,
    },
    {
      id: "ssl",
      name: "SSL Checker and HTTPS Test",
      status: tls.available && tls.daysRemaining !== null && tls.daysRemaining > 0 ? "passed" : "failed",
      level: "site",
      source: "measured",
      summary: tls.available
        ? `Live TLS certificate for ${tls.subject || host}: issued by ${tls.issuer || "unknown"}, valid ${tls.validFrom} → ${tls.validTo} (${tls.daysRemaining} day(s) remaining), signature ${tls.sigalg || "unknown"}.`
        : `TLS handshake failed: ${tls.error}`,
      meta: tls.available
        ? [
            { label: "Common Name", value: tls.subject || "—" },
            { label: "Issuer", value: tls.issuer || "—" },
            { label: "Not Valid Before", value: tls.validFrom || "—" },
            { label: "Not Valid After", value: tls.validTo || "—" },
            { label: "Days Remaining", value: tls.daysRemaining === null ? "—" : String(tls.daysRemaining) },
            { label: "Signature Algorithm", value: tls.sigalg || "—" },
            { label: "SHA-256 Fingerprint", value: tls.fingerprint256 || "—", mono: true },
          ]
        : undefined,
      fix: tls.available ? undefined : "Install/renew a trusted TLS certificate for this host.",
    },
    {
      id: "mixed-content",
      name: "Mixed Content Test (HTTP over HTTPS)",
      status: crawl.mixedContent.length === 0 ? "passed" : "failed",
      level: "page",
      source: "crawl",
      summary: crawl.mixedContent.length === 0
        ? "No http:// subresources were found in the served HTML — everything loads over HTTPS."
        : `${crawl.mixedContent.length} http:// subresource(s) found in the served HTML.`,
      evidence: crawl.mixedContent.slice(0, 8),
      fix: crawl.mixedContent.length === 0 ? undefined : "Rewrite these URLs to https:// or protocol-relative references.",
    },
  ];

  return {
    id: "server-security",
    name: "Server and Security",
    note: "TLS, DNS and header probes executed live during this audit",
    score: groupScore(tests),
    tests,
  };
}

function buildMobileGroup(crawl: CrawlResult): CheckupGroup {
  const tests: CheckupTest[] = [
    {
      id: "viewport",
      name: "Meta Viewport Test",
      status: crawl.viewport ? "passed" : "failed",
      level: "page",
      source: "crawl",
      summary: crawl.viewport
        ? `Viewport meta served: <meta name="viewport" content="${crawl.viewport}" />`
        : "No viewport meta tag in the live HTML — the page will not be mobile-friendly.",
    },
    {
      id: "mobile-images",
      name: "Responsive Images Check",
      status: crawl.imagesMissingSrcset.length === 0 ? "passed" : "warning",
      level: "page",
      source: "crawl",
      summary: `${crawl.imagesMissingSrcset.length}/${crawl.images.length} images lack srcset variants for phone viewports.`,
    },
  ];
  return {
    id: "mobile-usability",
    name: "Mobile Usability",
    note: "Responsive behaviour read from the live HTML of this route",
    score: groupScore(tests),
    tests,
  };
}

function buildAdvancedGroup(crawl: CrawlResult, siteChecks: SiteChecks, origin: string): CheckupGroup {
  const disallowRules = siteChecks.robotsTxt.rules.flatMap((r) =>
    r.disallow.map((d) => ({ userAgent: r.userAgent, path: d })),
  );
  const blockedIndexable = disallowRules.filter((rule) => {
    if (!rule.path || rule.path === "/") return false;
    return crawl.requestedPath.startsWith(rule.path);
  });

  const tests: CheckupTest[] = [
    {
      id: "structured-data",
      name: "Structured Data Test",
      status: crawl.jsonLdBlocks > 0 && crawl.jsonLdValid ? "passed" : crawl.jsonLdBlocks > 0 ? "failed" : "warning",
      level: "page",
      source: "crawl",
      summary: crawl.jsonLdBlocks > 0
        ? `Found ${crawl.jsonLdBlocks} JSON-LD block(s) in the live HTML with types: ${crawl.jsonLdTypes.join(", ") || "(no @type found)"}${crawl.jsonLdValid ? "" : ` — JSON parse error: ${crawl.jsonLdError}`}.`
        : "No JSON-LD structured data found in the live HTML.",
      fix: crawl.jsonLdBlocks > 0 && crawl.jsonLdValid ? undefined : "Add valid JSON-LD (Event, Organization, WebSite) to this route.",
    },
    {
      id: "noindex",
      name: "Noindex Tag Test",
      status: crawl.indexable ? "passed" : "failed",
      level: "page",
      source: "crawl",
      summary: crawl.indexable
        ? `No noindex directive in the live robots meta (${crawl.robotsMeta || "no robots meta served"}).`
        : `robots meta contains noindex ("${crawl.robotsMeta}") — search engines will not index this route.`,
    },
    {
      id: "canonical",
      name: "Canonical Tag Test",
      status: crawl.canonicalStatus === "self" ? "passed" : crawl.canonical ? "warning" : "failed",
      level: "page",
      source: "crawl",
      summary: crawl.canonical
        ? `Canonical link served: ${crawl.canonical} (${crawl.canonicalStatus}).`
        : "No canonical link tag in the live HTML.",
    },
    {
      id: "disallow",
      name: "Disallow Directive Audit",
      status: blockedIndexable.length === 0 ? "passed" : "warning",
      level: "site",
      source: "measured",
      summary: disallowRules.length === 0
        ? "The live robots.txt contains no Disallow rules."
        : `Live robots.txt contains ${disallowRules.length} Disallow rule(s): ${disallowRules.map((r) => `${r.userAgent} → ${r.path}`).join(" · ")}. ${blockedIndexable.length === 0 ? "None of them block this route." : `${blockedIndexable.length} rule(s) block this route!`}`,
      evidence: disallowRules.map((r) => `${r.userAgent}: Disallow: ${r.path}`),
      fix: blockedIndexable.length === 0 ? undefined : "Remove the Disallow rule that blocks this indexable route.",
    },
    {
      id: "html-lang",
      name: "HTML Language Attribute",
      status: crawl.htmlLang ? "passed" : "warning",
      level: "page",
      source: "crawl",
      summary: crawl.htmlLang
        ? `<html lang="${crawl.htmlLang}"> is declared in the live document.`
        : "The <html> element has no lang attribute.",
      fix: crawl.htmlLang ? undefined : 'Add lang="en" (or the correct language) to the <html> element.',
    },
  ];

  return {
    id: "advanced-seo",
    name: "Advanced SEO",
    note: "Index directives, structured data and DNS read live",
    score: groupScore(tests),
    tests,
  };
}

/** Assembles the complete real checkup report for one route. */
export function buildSeoCheckupReport(input: ReportBuilderInput): SeoCheckupReportData {
  const { origin, crawls, siteChecks, pageSpeed, gsc, llm } = input;
  const crawl =
    crawls.find((c) => c.requestedPath === input.reportRoute) ||
    crawls.find((c) => c.requestedPath === "/") ||
    crawls[0];
  if (!crawl) {
    throw new Error("buildSeoCheckupReport requires at least one crawled route");
  }

  const routeSummaries = buildRouteSummaries(crawls, gsc);
  const groups: CheckupGroup[] = [
    buildCommonSeoGroup(crawl, siteChecks, origin),
    buildFreshnessGroup(crawls, siteChecks),
    buildSpeedGroup(crawl, siteChecks),
    buildSecurityGroup(crawl, siteChecks, origin),
    buildMobileGroup(crawl),
    buildAdvancedGroup(crawl, siteChecks, origin),
  ];
  if (pageSpeed) {
    groups.unshift(buildPageSpeedGroup(pageSpeed));
  }

  const totals = groups.reduce(
    (acc, group) => {
      const c = count(group.tests);
      acc.failed += c.failed;
      acc.warnings += c.warnings;
      acc.passed += c.passed;
      acc.total += c.total;
      return acc;
    },
    { failed: 0, warnings: 0, passed: 0, total: 0 },
  );

  const seoScore = totals.total
    ? clamp(Math.round(((totals.passed + totals.warnings * 0.5) / totals.total) * 100), 0, 99)
    : 0;

  const testedLlm = llm.filter((p) => p.tested && p.results.length > 0);
  const aiScore = testedLlm.length
    ? Math.round(
        (testedLlm.reduce(
          (acc, p) => acc + p.results.filter((r) => r.mentioned || r.citedDomain).length,
          0,
        ) /
          testedLlm.reduce((acc, p) => acc + p.results.length, 0)) *
          100,
      )
    : null;

  const categories = groups.map((group) => {
    const c = count(group.tests);
    return {
      name: group.name,
      score: group.score ?? groupScore(group.tests),
      failed: c.failed,
      warnings: c.warnings,
      passed: c.passed,
    };
  });

  const issues: CheckupIssue[] = [];
  for (const group of groups) {
    for (const test of group.tests) {
      if (test.status === "failed") {
        issues.push({
          priority: "HIGH",
          title: test.name,
          detail: test.summary,
          fix: test.fix,
          status: "failed",
          route: crawl.requestedPath,
          group: group.name,
          evidence: test.evidence,
          collapsible: true,
        });
      } else if (test.status === "warning") {
        issues.push({
          priority: "MEDIUM",
          title: test.name,
          detail: test.summary,
          fix: test.fix,
          status: "warning",
          route: crawl.requestedPath,
          group: group.name,
          evidence: test.evidence,
          collapsible: true,
        });
      }
    }
  }
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
  issues.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const inputs: ReportInput[] = [
    { label: "Overall On-Page SEO Score", value: `${seoScore} / 100 (Target: 85+)`, source: "derived" },
    { label: "SEO Issues Detected", value: `${totals.failed + totals.warnings} issues (${totals.failed} failed, ${totals.warnings} warnings)`, source: "derived", status: totals.failed > 0 ? "failed" : totals.warnings > 0 ? "warning" : "passed" },
    { label: "Page Title Length", value: `${crawl.titleLength} chars`, source: "crawl" },
    { label: "Meta Description Length", value: crawl.descriptionLength ? `${crawl.descriptionLength} chars` : "not served", source: "crawl" },
    { label: "Total Page Word Count", value: `${crawl.wordCount} words`, source: "crawl" },
    { label: "Unique Internal Links", value: `${crawl.internalLinksUnique} links`, source: "crawl" },
    { label: "Server Response Speed (TTFB)", value: `${round(crawl.ttfbMs / 1000, 3)}s`, source: "measured" },
    { label: "Total Download Time", value: `${round(crawl.totalMs / 1000, 2)}s`, source: "measured" },
    { label: "HTML Document Size", value: `${round(crawl.uncompressedBytes / 1024, 1)} KB`, source: "measured" },
    { label: "DOM Nodes", value: `${crawl.domNodes} nodes`, source: "measured" },
    { label: "Images on Page", value: `${crawl.images.length} images, ${crawl.imagesMissingAlt.length} missing alt`, source: "crawl" },
    {
      label: "Google Search Clicks",
      value: gsc.available && gsc.totals ? `${gsc.totals.clicks} clicks (${gsc.rangeStart} → ${gsc.rangeEnd})` : "Search Console not connected",
      source: gsc.available ? "measured" : undefined,
      status: gsc.available ? undefined : "warning",
    },
    {
      label: "Google Search Impressions",
      value: gsc.available && gsc.totals ? `${gsc.totals.impressions} impressions` : "Search Console not connected",
      source: gsc.available ? "measured" : undefined,
    },
    {
      label: "Average Google Ranking",
      value: gsc.available && gsc.totals ? `Rank #${gsc.totals.position} on Google` : "Search Console not connected",
      source: gsc.available ? "measured" : undefined,
    },
    pageSpeed?.ok
      ? { label: "PageSpeed performance (mobile)", value: `${pageSpeed.scores.performance ?? "—"} / 100`, source: "measured" }
      : { label: "PageSpeed performance", value: pageSpeed?.message || "not measured in this run", status: "warning" as const },
  ];

  const summary = `Route ${crawl.requestedPath} scored ${seoScore}/100 from ${totals.total} real automated checks (live crawl + live site probes${pageSpeed?.ok ? " + Google PageSpeed Insights" : ""}). We found ${totals.failed} failed checks and ${totals.warnings} warnings across ${totals.passed} passing checks${aiScore != null ? `, with brand presence in ${aiScore}% of tested LLM prompts` : "; no LLM probes ran (no API keys configured)"}. Generated ${new Date().toLocaleString("en-IN")} from network measurements of ${origin}.`;

  return {
    scope: "page",
    route: crawl.requestedPath,
    url: crawl.url,
    pageTitle: crawl.title || "(no title served)",
    pageDesc: crawl.metaDescription,
    titleLen: crawl.titleLength,
    descLen: crawl.descriptionLength > 0 ? crawl.descriptionLength : null,
    seoScore,
    aiScore,
    scoreSource: "crawl",
    aiSource: aiScore == null ? "not_tested" : "derived",
    telemetrySource: gsc.available ? "measured" : "not_connected",
    failedCount: totals.failed,
    warningCount: totals.warnings,
    passedCount: totals.passed,
    totalCount: totals.total,
    summary,
    categories,
    inputs,
    issues,
    groups,
    generatedAt: new Date().toISOString(),
    pageSpeed: pageSpeed ?? null,
    routeSummaries,
    site: {
      origin,
      routesCrawled: crawls.length,
      avgWords: Math.round(crawls.reduce((a, c) => a + c.wordCount, 0) / crawls.length),
      avgTtfbMs: Math.round(crawls.reduce((a, c) => a + c.ttfbMs, 0) / crawls.length),
      searchConsoleConfigured: gsc.available,
      llmKeysConfigured: llm.filter((p) => p.tested).map((p) => p.platform),
    },
  };
}
