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

import { isGenericAlt } from "./altText";
import { RECOMMENDED_DESC, RECOMMENDED_TITLE, computeRouteScore, pageFindings } from "./pageFindings.service";

const TITLE_MIN = RECOMMENDED_TITLE.min;
const TITLE_MAX = RECOMMENDED_TITLE.max;
import { getSiteHost, getSiteName } from "../../config/seoSite";
import type { CrawlResult } from "./crawler.service";
import type { SiteChecks } from "./siteChecks.service";
import { brokenLinksOf, type LinkStatusMap } from "./linkCheck.service";
import { buildAuditContext, buildAuditGroups } from "./siteAudit.checks";
import { buildChecklist } from "./checklist.service";
import type { GscResult } from "./gsc.service";
import type {
  CheckupGroup,
  CheckupFixKind,
  CheckupIssue,
  CheckupStatus,
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
  pageSpeedDesktop?: PageSpeedSnapshot | null;
  gsc: GscResult;
  llm: LlmPlatformResult[];
  /** Whether each link found on the crawled pages works. Absent on audits stored before links were followed. */
  linkStatuses?: LinkStatusMap | null;
}

/**
 * Who can fix each kind of check, and (for the admin) which issue of the "Issues to fix" list does it. A check that is
 * not listed here is a rule about the website's code or build.
 */
const ADMIN_FIX: Record<string, string> = {
  "meta-title": "title",
  "meta-description": "description",
  "social-meta": "og",
  "heading-tags": "h1",
  "image-alt": "image_alt",
  "structured-data": "schema",
  "canonical": "canonical",
  "noindex": "robots",
  "nofollow": "robots",
};
const CONTENT_FIX = new Set(["keywords-usage", "internal-linking", "content-freshness"]);
const SERVER_FIX = new Set(["canonicalization", "ssl", "http-redirect", "hsts", "http2", "ttfb"]);

function fixKindOf(testId: string, groupId: string): { fixKind: CheckupFixKind; adminIssueType?: string } {
  if (ADMIN_FIX[testId]) return { fixKind: "admin", adminIssueType: ADMIN_FIX[testId] };
  if (testId === "mixed-content") return { fixKind: "developer" };
  if (CONTENT_FIX.has(testId)) return { fixKind: "content" };
  if (SERVER_FIX.has(testId) || groupId === "server-security") return { fixKind: "server" };
  return { fixKind: "developer" };
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
  return clamp(Math.round(((passed + warned * 0.5) / tests.length) * 100), 0, 100);
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

    const score = computeRouteScore(crawl);
    const { items: findings, positives } = pageFindings(crawl);

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
      failedChecks: findings.filter((f) => f.priority === "high").length,
      warningChecks: findings.filter((f) => f.priority !== "high").length,
      passedChecks: positives.length,
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

  const scoreTest = (id: string, name: string, value: number | null, note: string, extra: Pick<CheckupTest, "evidence" | "fix"> = {}): CheckupTest => ({
    ...extra,
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
    extra: Pick<CheckupTest, "evidence" | "fix"> = {},
  ): CheckupTest => ({
    ...extra,
    id: `psi-${id}`,
    name,
    status: testStatus,
    level: "page",
    source: "measured",
    summary: note,
    meta: [{ label: "Lighthouse lab value", value: display, mono: true }],
  });

  // What Google's run says causes the slowness (only what it returned; nothing is guessed)
  const dg = ps.diagnostics;
  const notPassed = (st: CheckupTest["status"]) => st !== "passed";
  const lcpStatus = vital(m.lcpMs ? m.lcpMs / 1000 : null, 2.5, 4.0);
  const tbtStatus = vital(m.tbtMs == null ? null : m.tbtMs / 1000, 0.2, 0.6);
  const siStatus = vital(m.siMs ? m.siMs / 1000 : null, 3.4, 5.8);
  const blockingLines = (dg?.renderBlocking ?? []).map((r) => `Holds up the first paint by ${r.ms} ms: ${r.url}`);
  const unusedLines = (dg?.unusedJs ?? []).map((r) => `${r.kb} KB of unused JavaScript: ${r.url}`);
  const cpuLines = (dg?.scriptCpu ?? []).map((r) => `Keeps the browser busy for ${r.ms} ms: ${r.url}`);
  const lcpParts = dg?.lcpBreakdown ?? [];
  const biggestLcpPart = [...lcpParts].sort((a, b) => b.ms - a.ms)[0];
  const LCP_ADVICE: Record<string, string> = {
    "time to first byte": "The server answers slowly. Check the hosting / cache (Cloudflare caching of the HTML).",
    "resource load delay": "The largest image starts downloading late. A developer can load it first (preload it or give it fetchpriority=\"high\") so it starts at once.",
    "resource load duration": "The largest image itself takes long to download. Serve a smaller, better-compressed version for this screen size.",
    "element render delay": "The image is ready but painted late, usually because scripts or stylesheets are still running. Reduce what loads before it.",
  };
  const lcpExtra: Pick<CheckupTest, "evidence" | "fix"> =
    dg && notPassed(lcpStatus)
      ? {
          evidence: [
            ...(dg.lcpElement ? [`Largest element: ${dg.lcpElement}`] : []),
            ...lcpParts.map((p) => `${p.label}: ${p.ms} ms`),
          ],
          fix: biggestLcpPart ? `Biggest part is "${biggestLcpPart.label}" (${biggestLcpPart.ms} ms). ${LCP_ADVICE[biggestLcpPart.label.toLowerCase()] ?? ""} This is a change in the website's code.`.trim() : undefined,
        }
      : {};
  const tbtExtra: Pick<CheckupTest, "evidence" | "fix"> =
    dg && notPassed(tbtStatus) && cpuLines.length
      ? { evidence: cpuLines, fix: "These scripts keep the browser busy. Load tag scripts (Tag Manager, Analytics, Facebook) after the page is interactive or remove the ones not needed; a developer can split the website's own code." }
      : {};
  const siExtra: Pick<CheckupTest, "evidence" | "fix"> =
    dg && notPassed(siStatus) && blockingLines.length
      ? { evidence: blockingLines, fix: "These files must load before anything is shown. A developer can inline the critical CSS and load the rest later." }
      : {};
  const perfExtra: Pick<CheckupTest, "evidence" | "fix"> =
    dg && sc.performance != null && sc.performance < 90 && (blockingLines.length || unusedLines.length)
      ? { evidence: [...blockingLines.slice(0, 3), ...unusedLines.slice(0, 3)], fix: "The biggest savings Google found are listed above. They are changes in the website's code, not in the admin." }
      : {};

  const tests: CheckupTest[] = [
    scoreTest("performance", "PageSpeed Performance Score", sc.performance, "Weighted from FCP, LCP, TBT, CLS and Speed Index for this route.", perfExtra),
    scoreTest("accessibility", "PageSpeed Accessibility Score", sc.accessibility, "Lighthouse accessibility audits: contrast, labels, names, keyboard order."),
    scoreTest("best-practices", "PageSpeed Best Practices Score", sc.bestPractices, "HTTPS, console errors, image quality, document metadata and deprecations."),
    scoreTest("seo", "PageSpeed SEO Score", sc.seo, "Google's own on-page SEO checks: title, meta description, link text, crawlability, viewport."),
    metricTest("fcp", "First Contentful Paint", m.fcpMs, m.fcpMs == null ? "not returned" : `${round(m.fcpMs / 1000, 2)}s`, vital(m.fcpMs ? m.fcpMs / 1000 : null, 1.8, 3.0), "How long the first text or image paints. Good is ≤ 1.8s, poor above 3.0s."),
    metricTest("lcp", "Largest Contentful Paint", m.lcpMs, m.lcpMs == null ? "not returned" : `${round(m.lcpMs / 1000, 2)}s`, lcpStatus, "When the largest above-the-fold element paints. Good is ≤ 2.5s, poor above 4.0s.", lcpExtra),
    metricTest("tbt", "Total Blocking Time", m.tbtMs, m.tbtMs == null ? "not returned" : `${m.tbtMs}ms`, tbtStatus, "Main-thread work that blocks interaction. Good is ≤ 200ms, poor above 600ms.", tbtExtra),
    metricTest("cls", "Cumulative Layout Shift", m.cls, m.cls == null ? "not returned" : String(round(m.cls, 4)), vital(m.cls, 0.1, 0.25), "Visual stability of the page. Good is ≤ 0.1, poor above 0.25."),
    metricTest("si", "Speed Index", m.siMs, m.siMs == null ? "not returned" : `${round(m.siMs / 1000, 2)}s`, siStatus, "How quickly the page fills in visually. Good is ≤ 3.4s, poor above 5.8s.", siExtra),
    // Real-user data only exists once Google has collected enough visits; without it there is nothing to judge, so it
    // is not a check (the group note says it is not available yet) instead of a warning nobody can fix.
    ...(ps.fieldData.available
      ? [
          {
            id: "psi-crux",
            name: "Real-user field data (Chrome UX Report)",
            status: (ps.fieldData.overall?.toUpperCase() === "GOOD" ? "passed" : "warning") as CheckupStatus,
            level: "page" as const,
            source: "measured" as const,
            summary: `Chrome UX Report reports ${ps.fieldData.overall ?? "a"} experience for this origin.`,
            meta: [{ label: "CrUX origin data", value: ps.fieldData.overall ?? "available" }],
          },
        ]
      : []),
  ];

  return {
    id: "page-speed",
    name: "Google PageSpeed Insights (Lighthouse)",
    note: `Live Google PageSpeed Insights run for ${ps.strategy}, fetched ${new Date(ps.fetchedAt).toLocaleString("en-IN")}${ps.cached ? " (cached ≤6h)" : ""}.${ps.fieldData.available ? "" : " Real-user data (Chrome UX Report) is not available for this site yet: Google shows it once enough people have visited."}`,
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
      fix: "Add author or team bios, cited sources and proof of credentials, and link this route from the main navigation to lift Content Trust above 60%.",
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
      cited > 0 ? `${getSiteHost().replace(/^www\./, "")} cited (${cited}/${p.results.length})` : "No domain citation",
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
    /book|register|enquir|inquir|contact|call|quote|request|schedule|apply|sign ?up|pre-?book|donate/i.test(l.anchorText),
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
        ? "Book / Register / Enquire / Contact style CTAs were found in this route's live links."
        : "No obvious book/register/enquire/contact CTA anchor text was found in this route's links.",
      fix: hasCtaLinks ? undefined : "Add at least one descriptive CTA link (for example Book / Enquire / Contact us) in the main content.",
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
  const blogPosts = crawls.filter((c) => c.requestedPath.startsWith("/blog/") && c.ok);
  const thinPages = crawls.filter((c) => c.ok && c.wordCount < 300);

  const recommendations: string[] = [];
  if (!paths.has("/faq")) {
    recommendations.push("Publish an FAQ page (with FAQPage schema) covering the questions customers ask most before they get in touch.");
  }
  if (blogPosts.length < 5) {
    recommendations.push(`Only ${blogPosts.length} blog post(s) exist on the live sitemap — publish topical content that answers the questions your customers search for, to grow organic reach.`);
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

/** Pages that link to each page, among the audited pages (a page is not counted as linking to itself). */
function incomingLinkCount(target: CrawlResult, crawls: CrawlResult[]): number {
  const cleanPath = (p: string) => p.replace(/\/+$/, "") || "/";
  const targetPath = cleanPath(new URL(target.url).pathname);
  const bareHost = (h: string) => h.toLowerCase().replace(/^www\./, "");
  const host = bareHost(new URL(target.url).hostname);
  let count = 0;
  for (const page of crawls) {
    if (!page.ok || page === target) continue;
    const linked = (page.links ?? []).some((link) => {
      if (!link.isInternal) return false;
      try {
        const u = new URL(link.href, page.url);
        return bareHost(u.hostname) === host && cleanPath(u.pathname) === targetPath;
      } catch {
        return false;
      }
    });
    if (linked) count += 1;
  }
  return count;
}

function buildSitemapTest(crawl: CrawlResult, crawls: CrawlResult[], siteChecks: SiteChecks, inSitemap: boolean): CheckupTest {
  const base = { id: "sitemap-test", name: "Sitemap Test", level: "site" as const, source: "measured" as const };
  const sm = siteChecks.sitemap;
  if (!sm.available) return { ...base, status: "failed", summary: `No reachable sitemap: ${sm.error}` };
  const paths = new Set(
    sm.entries.map((e) => {
      try {
        return new URL(e.loc).pathname.replace(/\/+$/, "") || "/";
      } catch {
        return "";
      }
    }),
  );
  const audited = crawls.filter((c) => paths.has(new URL(c.url).pathname.replace(/\/+$/, "") || "/"));
  // A sitemap should list only live, indexable pages: a redirect, an error or a noindex page does not belong in it.
  const wrong = audited.filter((c) => !c.ok || c.httpStatus !== 200 || !c.indexable || c.canonicalStatus === "points_elsewhere");
  const insecure = sm.entries.filter((e) => e.loc.startsWith("http://") && siteChecks.origin.startsWith("https://"));
  const problems = wrong.length + insecure.length;
  return {
    ...base,
    status: problems > 0 ? "failed" : inSitemap ? "passed" : "warning",
    summary:
      `Live sitemap at ${sm.url} lists ${sm.entries.length} URL(s); this route ${inSitemap ? "is" : "is NOT"} included. ` +
      `${audited.length} of them were audited: ${problems === 0 ? "all are live, indexable pages." : `${problems} should not be in the sitemap.`}`,
    evidence: [
      ...wrong.map((c) => `${c.url} → ${c.ok ? (c.indexable ? (c.canonicalStatus === "points_elsewhere" ? "canonical points to another page" : `HTTP ${c.httpStatus}`) : "noindex") : `HTTP ${c.httpStatus || "no response"}`}`),
      ...insecure.map((e) => `${e.loc} → http:// address in an https site`),
    ].slice(0, 12),
    fix: problems > 0 ? "Remove these from sitemap.xml (or fix the pages) so it lists only live, indexable https pages." : undefined,
  };
}

function buildCommonSeoGroup(crawl: CrawlResult, siteChecks: SiteChecks, origin: string, linkStatuses?: LinkStatusMap | null, crawls: CrawlResult[] = [crawl]): CheckupGroup {
  const title = crawl.title || "";
  const desc = crawl.metaDescription;
  const ogKeys = ["og:title", "og:description", "og:url", "og:image", "og:type"];
  // A stored crawl may have lost its empty objects; treat a missing one as "no tags".
  const openGraph = crawl.openGraph ?? {};
  const twitterTags = crawl.twitter ?? {};
  const ogPresent = ogKeys.filter((k) => openGraph[k]);
  const twitterKeys = ["twitter:card", "twitter:title", "twitter:description", "twitter:image"];
  const twitterPresent = twitterKeys.filter((k) => twitterTags[k]);
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
  // The page's topic words: the title without the brand ("Moksha Voyage | Funeral & Cremation Services" → funeral,
  // cremation, services). The brand name is left out: Google shows it on its own, it does not have to be in the
  // description. The words the page itself uses most come first.
  const brandWords = new Set(getSiteName().toLowerCase().split(/\s+/));
  const TITLE_STOP = new Set(["and", "the", "for", "with", "your", "our", "from", "this", "that", "into", "about", "page", "home", "official", "best"]);
  const titleTopic = title
    .split(/\s+[|–—-]\s+|\s*\|\s*/)
    .filter((part) => !part.toLowerCase().split(/\s+/).every((w) => brandWords.has(w.replace(/[^a-z0-9]/g, ""))))
    .join(" ");
  const bodyLower = (crawl.bodyText || "").toLowerCase();
  const occurrences = (w: string) => (bodyLower.match(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g")) || []).length;
  const keywordCandidates = Array.from(
    new Set(
      titleTopic
        .toLowerCase()
        .split(/[^a-z0-9\u0900-\u097f]+/)
        .filter((w) => w.length > 3 && !TITLE_STOP.has(w) && !brandWords.has(w)),
    ),
  )
    .sort((a, b) => occurrences(b) - occurrences(a))
    .slice(0, 3);
  const headingsText = [...crawl.h1, ...crawl.h2, ...crawl.h3].join(" ").toLowerCase();
  const descLower = (desc || "").toLowerCase();
  let keywordsPassing = 0;
  const missingKeyword: string[] = [];
  for (const kw of keywordCandidates) {
    const inTitle = title.toLowerCase().includes(kw);
    const inDesc = desc ? descLower.includes(kw) : false;
    const inHead = headingsText.includes(kw);
    if (inTitle && inDesc && inHead) keywordsPassing += 1;
    else missingKeyword.push(`"${kw}" is missing from the ${[!inDesc ? "meta description" : "", !inHead ? "headings" : ""].filter(Boolean).join(" and ")}`);
    keywordRows.push([kw, inTitle ? "✓" : "✗", desc ? (inDesc ? "✓" : "✗") : "n/a", inHead ? "✓" : "✗"]);
  }
  const keywordCoverage = keywordCandidates.length ? keywordsPassing / keywordCandidates.length : 0;

  const tests: CheckupTest[] = [
    {
      id: "meta-title",
      name: "Meta Title Test",
      status: crawl.titleLength >= TITLE_MIN && crawl.titleLength <= TITLE_MAX ? "passed" : "warning",
      level: "page",
      source: "crawl",
      summary: `Length: ${crawl.titleLength} characters measured on the live page. Target: ${TITLE_MIN}-${TITLE_MAX} characters.`,
      meta: [{ label: "Title", value: title || "(missing)" }],
      fix: crawl.titleLength > TITLE_MAX ? `Shorten the title to ${TITLE_MAX} characters or fewer so Google doesn't truncate it.` : crawl.titleLength < TITLE_MIN ? `Expand the title to at least ${TITLE_MIN} characters with the primary keyword.` : undefined,
    },
    {
      id: "meta-description",
      name: "Meta Description Test",
      status: desc && desc.length >= RECOMMENDED_DESC.min && desc.length <= RECOMMENDED_DESC.max ? "passed" : desc ? "warning" : "failed",
      level: "page",
      source: "crawl",
      summary: desc
        ? `Description length measured on the live page: ${desc.length} characters. Target: ${RECOMMENDED_DESC.min}-${RECOMMENDED_DESC.max} characters for full SERP display.`
        : "No <meta name=\"description\"> is served on this route.",
      meta: desc ? [{ label: "Text", value: desc }] : undefined,
      fix: !desc
        ? `Add a ${RECOMMENDED_DESC.min}-${RECOMMENDED_DESC.max} character meta description with the primary keyword and a reason to click (Issues to fix → Descriptions).`
        : desc.length > RECOMMENDED_DESC.max
          ? `Shorten it to ${RECOMMENDED_DESC.max} characters or fewer so Google shows all of it (Issues to fix → Descriptions).`
          : desc.length < RECOMMENDED_DESC.min
            ? `Lengthen it to at least ${RECOMMENDED_DESC.min} characters (Issues to fix → Descriptions).`
            : undefined,
    },
    {
      id: "serp-preview",
      name: "Google Search Results Preview Test",
      status: crawl.canonicalStatus === "self" && title ? "passed" : "warning",
      level: "page",
      source: "derived",
      summary:
        crawl.canonicalStatus === "self" && title
          ? `Canonical URL ${crawl.canonical || crawl.url} with a ${crawl.titleLength}-char title${desc ? ` and ${crawl.descriptionLength}-char description` : " and no description"} renders a valid desktop/mobile snippet.`
          : !title
            ? "The page has no title, so Google has to make up the headline of its search result."
            : `The canonical link points to ${crawl.canonical || "nothing"}, not to this page (${crawl.url}), so Google may show a different address in the search result.`,
      fix: crawl.canonicalStatus === "self" && title ? undefined : !title ? "Add a page title (Issues to fix → Page titles)." : "Fix the Canonical Tag Test below; this check follows it.",
      // the cause decides who fixes it: a missing title or canonical is in the Issues list, a wrong canonical is edited in the page's SEO
      ...(!title ? { fixKind: "admin" as const, adminIssueType: "title" } : crawl.canonicalStatus !== "self" ? { fixKind: "admin" as const, adminIssueType: "canonical" } : { fixKind: "content" as const }),
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
          rows: ogKeys.map((k) => [k, openGraph[k] || "missing"]),
        },
        {
          title: "Twitter Card",
          headers: ["Tag", "Content"],
          rows: twitterKeys.map((k) => [k, twitterTags[k] || "missing"]),
        },
      ],
    },
    {
      id: "keywords-usage",
      name: "Keywords Usage Test",
      status: !keywordCandidates.length ? "warning" : keywordCoverage >= 0.66 ? "passed" : keywordCoverage > 0 ? "warning" : "failed",
      level: "page",
      source: "derived",
      summary: keywordCandidates.length
        ? `${keywordsPassing}/${keywordCandidates.length} topic words of the title (${keywordCandidates.join(", ")}) also appear in the meta description and the headings of the live page.`
        : "The title has no topic words besides the brand name, so there is nothing to compare.",
      evidence: missingKeyword.length ? missingKeyword : undefined,
      tables: [
        { headers: ["Keyword", "Title tag", "Meta description", "Headings"], rows: keywordRows },
      ],
      fix: keywordCoverage >= 0.66 ? undefined : "Use the missing topic words listed above in the meta description and in at least one heading of this page (both can be changed from the admin).",
    },
    {
      id: "heading-tags",
      name: "Heading Tags Test",
      status: crawl.h1.length === 1 ? "passed" : "failed",
      level: "page",
      source: "crawl",
      summary: `Detected ${crawl.h1.length} H1, ${crawl.h2.length} H2 and ${crawl.h3.length} H3 tags in the live HTML.`,
      lists: [{ title: "Detected H1 Tags", items: crawl.h1.length ? crawl.h1 : ["(none)"] }],
      fix:
        crawl.h1.length === 1
          ? undefined
          : crawl.h1.length > 1 && new Set(crawl.h1.map((h) => h.trim().toLowerCase())).size === 1
            ? "The same H1 text is in the page twice (often one copy for mobile and one for desktop). Render a single H1 and switch its look with CSS."
            : "Keep exactly one descriptive H1 per route; demote banner headings to H2.",
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
    buildSitemapTest(crawl, crawls, siteChecks, inSitemap),
    {
      id: "image-alt",
      name: "Image Alt Test",
      status: crawl.imagesMissingAlt.length === 0 ? "passed" : "failed",
      level: "page",
      source: "crawl",
      summary: `${crawl.imagesMissingAlt.length} of ${crawl.images.length} <img> tags on ${crawl.requestedPath} have no "alt" attribute (live HTML; alt="" on decorative images is fine).`,
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

  // Only said when it was measured: an older stored audit never followed links or counted text, so it is not shown as "passed".
  if (linkStatuses) {
    const broken = brokenLinksOf(crawl, linkStatuses);
    const total = broken.internal.length + broken.external.length;
    tests.push({
      id: "broken-links",
      name: "Broken Links Test",
      status: broken.internal.length > 0 ? "failed" : broken.external.length > 0 ? "warning" : "passed",
      level: "page",
      source: "measured",
      summary:
        total === 0
          ? `All ${broken.checked} links checked on this page work (links that timed out or refused the audit's request are not counted as broken).`
          : `${broken.internal.length} broken link(s) to this site and ${broken.external.length} to other sites, out of ${broken.checked} checked on this page.`,
      evidence: [...broken.internal, ...broken.external].slice(0, 12).map((l) => `${l.href} → ${l.status}`),
      fix:
        total === 0
          ? undefined
          : broken.internal.length > 0
            ? "A link to a page of this site that does not exist: add a 301 redirect from it to the right page (Issues to fix → Broken links), or correct the link."
            : "A link to another website that does not answer. If it sits in the header or footer it is on every page and is changed once in the website's shared layout; a link written in a page's text is changed in Pages & CMS.",
      fixKind: broken.internal.length > 0 ? "admin" : "developer",
      adminIssueType: broken.internal.length > 0 ? "redirect" : undefined,
    });
  }
  if (crawls.length > 1 && crawl.requestedPath !== "/") {
    const incoming = incomingLinkCount(crawl, crawls);
    tests.push({
      id: "incoming-links",
      name: "Links Pointing to This Page Test",
      status: incoming >= 2 ? "passed" : "warning",
      level: "page",
      source: "crawl",
      benchmark: "2 or more pages link here",
      summary:
        incoming === 0
          ? `No other audited page links to this page (${crawls.length - 1} checked), so Google can only find it through the sitemap.`
          : incoming === 1
            ? "Only one other audited page links to this page, so Google sees it as a minor page."
            : `${incoming} other audited pages link to this page.`,
      fix: incoming >= 2 ? undefined : "Link to this page from related pages and blog posts, using descriptive link text.",
    });
  }
  if (typeof crawl.textRatio === "number") {
    tests.push({
      id: "text-html-ratio",
      name: "Text to HTML Ratio Test",
      status: crawl.textRatio >= 10 ? "passed" : "warning",
      level: "page",
      source: "crawl",
      benchmark: "10% or more",
      summary: `Visible text is ${crawl.textRatio}% of the page's HTML (${crawl.wordCount} words).${
        crawl.htmlLength && crawl.inlineScriptBytes ? ` Inline scripts (the website framework's page data and analytics snippets) are ${Math.round((crawl.inlineScriptBytes / crawl.htmlLength) * 100)}% of it.` : ""
      }`,
      fix:
        crawl.textRatio >= 10
          ? undefined
          : "Most of the HTML is code, not text. A website developer can shrink it (less inline page data, fewer wrapper elements); adding real copy where a page is thin also helps.",
    });
  }

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
      evidence: crawl.syncHeadScriptSrcs?.length ? crawl.syncHeadScriptSrcs.slice(0, 10) : undefined,
      fix: crawl.syncHeadScripts === 0 ? undefined : "Add defer (or async where safe) to the scripts listed, or move them to the end of body. This is a change in the website's code.",
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

function buildCanonicalizationTest(siteChecks: SiteChecks, cleanHost: string): CheckupTest {
  const c = siteChecks.canonicalization;
  const apex = `https://${cleanHost}/`;
  const www = `https://www.${cleanHost}/`;
  const base = { id: "canonicalization", name: "URL Canonicalization Test", level: "site" as const, source: "measured" as const };
  if (c.apexStatus !== 200) {
    return {
      ...base,
      status: "failed",
      summary: `${apex} did not answer with 200 (got ${c.apexStatus ?? "no response"}).`,
      fix: "Make the main address answer 200.",
    };
  }
  if (c.wwwStatus === null) {
    return {
      ...base,
      status: "failed",
      summary: `${www} did not answer${c.wwwError ? ` (${c.wwwError === "ENOTFOUND" ? "ENOTFOUND: no DNS record exists for www" : c.wwwError})` : ""}. Anyone who types www in front of the name gets nothing, and Google cannot reach that version. ${apex} answered 200.`,
      fix: onCloudflare(siteChecks)
        ? `In Cloudflare: 1) DNS → add a record: type CNAME, name www, target ${cleanHost}, proxy status "Proxied". 2) Rules → Redirect Rules → create a rule: when Hostname equals www.${cleanHost}, redirect to ${apex}{path} (dynamic: concat("https://${cleanHost}", http.request.uri.path)) with status 301. This is a server setting, not something the admin can change.`
        : `Add a DNS record for www (a CNAME to ${cleanHost}) and redirect ${www} to ${apex} with a 301 at the host or CDN. This is a server setting, not something the admin can change.`,
    };
  }
  if (c.wwwRedirectsToApex) {
    return { ...base, status: "passed", summary: `${apex} responded 200; ${www} responded ${c.wwwStatus} and redirects to the apex host.` };
  }
  return {
    ...base,
    status: "warning",
    summary: `${www} responded ${c.wwwStatus} but does not redirect to ${apex}, so the same site is served on two addresses.`,
    fix: `Redirect ${www} to ${apex} with a 301 at the host or CDN. This is a server setting, not something the admin can change.`,
  };
}

function buildSecurityGroup(crawl: CrawlResult, siteChecks: SiteChecks, origin: string): CheckupGroup {
  const host = new URL(origin).hostname;
  const cleanHost = host.replace(/^www\./, "");
  const tls = siteChecks.tls;
  const tests: CheckupTest[] = [
    buildCanonicalizationTest(siteChecks, cleanHost),
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
    ...buildTransportTests(siteChecks, origin),
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

/** True when the audited site is served through Cloudflare (seen in its response headers) */
const onCloudflare = (siteChecks: SiteChecks): boolean => (siteChecks.headers?.cdnIndicators ?? []).some((c) => /cloudflare/i.test(c));

/** How the insecure http:// address is handled, and whether browsers are told to stay on https. Only for an https site. */
function buildTransportTests(siteChecks: SiteChecks, origin: string): CheckupTest[] {
  if (!origin.startsWith("https://")) return [];
  const tests: CheckupTest[] = [];
  const r = siteChecks.httpRedirect;
  if (r) {
    const permanent = r.status === 301 || r.status === 308;
    const sends = r.status !== null && r.status >= 300 && r.status < 400;
    tests.push({
      id: "http-redirect",
      name: "HTTP to HTTPS Redirect Test",
      status: permanent ? "passed" : "warning",
      level: "site",
      source: "measured",
      summary: permanent
        ? `http:// is sent to ${r.location ?? "https"} with a permanent redirect (${r.status}).`
        : sends
          ? `http:// is sent to ${r.location ?? "https"} with a temporary redirect (${r.status}). Google keeps treating the http address as a separate page.`
          : r.status === null
            ? `http:// did not answer (${r.error ?? "no response"}).`
            : `http:// answered ${r.status} instead of redirecting to https, so the site is reachable on two addresses.`,
      fix:
        permanent || r.status === null
          ? undefined
          : onCloudflare(siteChecks)
            ? `Cloudflare's "Always Use HTTPS" answers ${r.status} (temporary). For a permanent one: Cloudflare → Rules → Redirect Rules → create a rule: when "URL Scheme" equals http, redirect to concat("https://", http.host, http.request.uri.path) with status 301 (then "Always Use HTTPS" can stay on). This is a server setting, not something the admin can change.`
            : "Make the server answer http:// with a 301 (permanent) redirect to the https address, in the host, CDN or proxy. This is a server setting, not something the admin can change.",
    });
  }
  const hsts = siteChecks.headers.hsts;
  tests.push({
    id: "hsts",
    name: "HSTS (Strict-Transport-Security) Test",
    status: hsts ? "passed" : "warning",
    level: "site",
    source: "measured",
    summary: hsts ? `The site sends Strict-Transport-Security: ${hsts}` : "The site does not send the Strict-Transport-Security header, so browsers are not told to always use https.",
    fix: hsts
      ? undefined
      : onCloudflare(siteChecks)
        ? "In Cloudflare: SSL/TLS → Edge Certificates → HTTP Strict Transport Security (HSTS) → Enable HSTS, with a max age of 12 months (31536000 seconds). Turn it on only when every address of the site works over https. This is a server setting, not something the admin can change."
        : "Send the header Strict-Transport-Security: max-age=31536000; includeSubDomains from the server, CDN or proxy. This is a server setting, not something the admin can change.",
  });
  return tests;
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
      fix: crawl.jsonLdBlocks > 0 && crawl.jsonLdValid ? undefined : "Add valid JSON-LD (Organization, WebSite and a type that fits this page) to this route.",
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
        ? crawl.canonicalStatus === "self"
          ? `Canonical link served: ${crawl.canonical} (this page itself).`
          : `Canonical link served: ${crawl.canonical}, which is not this page's own address (${crawl.url}). Google may show that address instead of this page.`
        : "No canonical link tag in the live HTML.",
      fix:
        crawl.canonicalStatus === "self"
          ? undefined
          : crawl.canonical
            ? `Set this page's canonical URL to its own address in Pages & CMS → SEO (or clear the field so the page uses its own address). If the site was audited on a different address than the one it is published on (a test or local copy), this is expected there and passes on the live site.`
            : "Add a canonical URL for this page (Issues to fix → Main address, or Pages & CMS → SEO).",
      ...(crawl.canonicalStatus === "self" ? {} : { fixKind: "admin" as const, adminIssueType: "canonical" as const }),
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
  const { origin, crawls, siteChecks, gsc, llm } = input;
  const crawl =
    crawls.find((c) => c.requestedPath === input.reportRoute) ||
    crawls.find((c) => c.requestedPath === "/") ||
    crawls[0];
  if (!crawl) {
    throw new Error("buildSeoCheckupReport requires at least one crawled route");
  }

  // PageSpeed is a measurement of ONE address. A run made for another page (the audit measures the home page) is never
  // shown as this page's score, and nothing is derived from it: a page is "not measured" until it is measured.
  const samePage = (ps: PageSpeedSnapshot | null | undefined): PageSpeedSnapshot | null => {
    if (!ps) return null;
    try {
      const norm = (u: string) => `${new URL(u).host}${new URL(u).pathname.replace(/\/+$/, "")}`;
      return norm(ps.url) === norm(crawl.url) ? ps : null;
    } catch {
      return null;
    }
  };
  const pageSpeed = samePage(input.pageSpeed);
  const pageSpeedDesktop = samePage(input.pageSpeedDesktop);

  const routeSummaries = buildRouteSummaries(crawls, gsc);
  const groups: CheckupGroup[] = [
    buildCommonSeoGroup(crawl, siteChecks, origin, input.linkStatuses, crawls),
    buildFreshnessGroup(crawls, siteChecks),
    buildSpeedGroup(crawl, siteChecks),
    buildSecurityGroup(crawl, siteChecks, origin),
    buildMobileGroup(crawl),
    buildAdvancedGroup(crawl, siteChecks, origin),
  ];
  // The wider site-audit checks (crawlability, links and redirects, content, resources, security, hreflang / AMP).
  const auditCtx = buildAuditContext({ origin, crawls, siteChecks, linkStatuses: input.linkStatuses });
  for (const g of buildAuditGroups(crawl, auditCtx)) {
    groups.push({ id: `audit-${g.key}`, name: g.name, note: g.note, score: groupScore(g.tests), tests: g.tests });
  }
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
    ? clamp(Math.round(((totals.passed + totals.warnings * 0.5) / totals.total) * 100), 0, 100)
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
      const how = test.fixKind ? { fixKind: test.fixKind, adminIssueType: test.adminIssueType } : fixKindOf(test.id, group.id);
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
          testId: test.id,
          ...how,
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
          testId: test.id,
          ...how,
          collapsible: true,
        });
      }
    }
  }
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
  issues.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // An audit stored before links, text ratio and the http redirect were measured cannot show those checks. Say so
  // instead of leaving them out silently.
  const missingChecks: string[] = [];
  if (!input.linkStatuses) missingChecks.push("broken links, images and resources");
  if (typeof crawl.textRatio !== "number") missingChecks.push("text-to-HTML ratio");
  if (crawl.hasDoctype === undefined) missingChecks.push("redirects, doctype, compression, duplicate content and the other newer page checks");
  if (origin.startsWith("https://") && !siteChecks.httpRedirect) missingChecks.push("http to https redirect");
  if (!siteChecks.llmsTxt) missingChecks.push("llms.txt, TLS version and robots/sitemap format");
  const inputs: ReportInput[] = [
    ...(missingChecks.length > 0
      ? [{ label: "Audit data is out of date", value: `This stored audit has no ${missingChecks.join(", ")} data. Click "Re-Audit Page" to measure them.`, source: "derived" as const, status: "warning" as const }]
      : []),
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
    {
      label: "Images on Page",
      value: (() => {
        // decorative images (hidden from screen readers) are meant to have an empty alt: they are not counted as weak
        const weak = crawl.images.filter((i) => !i.isDecorative && i.src && isGenericAlt(i.alt)).length;
        const decorative = crawl.images.filter((i) => i.isDecorative).length;
        return `${crawl.images.length} images · ${crawl.imagesMissingAlt.length} without an alt attribute · ${weak} with empty or generic alt${decorative ? ` · ${decorative} decorative (correctly empty)` : ""}`;
      })(),
      source: "crawl",
    },
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
    checklist: buildChecklist({ crawl, origin, crawls, siteChecks, linkStatuses: input.linkStatuses, pageSpeed }),
    issues,
    groups,
    generatedAt: new Date().toISOString(),
    pageSpeed: pageSpeed ?? null,
    pageSpeedDesktop: pageSpeedDesktop && pageSpeedDesktop.ok ? pageSpeedDesktop : null,
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
