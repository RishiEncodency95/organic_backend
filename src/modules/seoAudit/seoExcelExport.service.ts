import * as XLSX from "xlsx";
import SeoAuditSnapshot from "../../models/seoAudit.model";
import SeoFixLog from "../../models/seoFixLog.model";
import { getSiteHost, getSiteName, getSiteOrigin } from "../../config/seoSite";
import type { CrawlResult } from "./crawler.service";
import type { SeoCheckupReportData } from "./types";
import { computePendingState } from "./seoPending.service";

/** Excel runs a cell that starts with = + - @ (or a tab / CR) as a formula: prefix such text with an apostrophe. */
export function safeCell<T>(v: T): T | string {
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(v)) return `'${v}`;
  return v;
}
const safeRow = (row: unknown[]) => row.map((c) => safeCell(c));
const safeObj = <T extends Record<string, unknown>>(row: T): T =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, safeCell(v)])) as T;

export const seoExcelExportService = {
  /**
   * Generates a multi-tab Excel (.xlsx) workbook Buffer
   */
  async generateAuditExcel(): Promise<Buffer> {
    const origin = getSiteOrigin();
    const siteBrand = getSiteName();

    // 1. Fetch latest audit snapshot & fix logs
    const [snapshot, fixLogs, totalAppliedFixes, pendingState] = await Promise.all([
      SeoAuditSnapshot.findOne().sort({ createdAt: -1 }).lean(),
      SeoFixLog.find().sort({ createdAt: -1 }).limit(200).lean(),
      SeoFixLog.countDocuments({ status: "applied", reverted: false }),
      computePendingState(),
    ]);

    const report = (snapshot?.report as SeoCheckupReportData) || null;
    const crawls = (snapshot?.crawls as CrawlResult[]) || [];
    const overallScore: number | null = report?.seoScore ?? null;
    const totalPages = crawls.length;
    const durationSec = snapshot?.durationMs ? Math.round(snapshot.durationMs / 1000) : null;
    const auditDate = snapshot?.createdAt ? new Date(snapshot.createdAt).toISOString() : "No audit has been run yet";
    const openPendingChecks = pendingState.hasAudit ? pendingState.counts.pending : (report?.failedCount || 0) + (report?.warningCount || 0);

    const catScore = (term: string): number | string => {
      const match = report?.categories?.find((c) => c.name.toLowerCase().includes(term.toLowerCase()));
      return match?.score ?? "N/A";
    };
    const scoreCell = (n: number | null) => (n === null ? "N/A" : `${n} / 100`);

    const wb = XLSX.utils.book_new();

    // ─────────────────────────────────────────────────────────────────────────────
    // TAB 1: Executive Summary
    // ─────────────────────────────────────────────────────────────────────────────
    const summaryRows = [
      [`${siteBrand.toUpperCase()} - SEO AUDIT & SELF-HEALING REPORT`],
      ["Confidential"],
      [],
      ["Property Domain", origin],
      ["Brand Name", siteBrand],
      ["Audit Completed At", auditDate],
      ["Audit Duration", durationSec === null ? "N/A" : `${durationSec} seconds`],
      [],
      ["CORE KPI METRICS", "VALUE", "STATUS"],
      ["Overall SEO Report Score (at audit time)", scoreCell(overallScore), overallScore === null ? "NO AUDIT" : overallScore >= 80 ? "HEALTHY" : overallScore >= 60 ? "NEEDS WORK" : "CRITICAL"],
      ["Live Health Score (fixes applied since audit)", scoreCell(pendingState.healthScore), pendingState.healthScoreAtAudit === null ? "NO AUDIT" : `Was ${pendingState.healthScoreAtAudit} at audit time`],
      ["Total Crawled Pages", totalPages, "Live Analyzed"],
      ["Autonomous Fixes Resolved", totalAppliedFixes, "Committed to MongoDB"],
      ["Open Pending Issues", openPendingChecks, "Actionable"],
      ["Resolved, awaiting website build", pendingState.counts.resolved, "Fixed in database"],
      [],
      ["SCORE BREAKDOWN BY DIMENSION", "SCORE (0-100)", "EVALUATION"],
      ["Technical SEO & Infrastructure", catScore("server"), "Server, HTTPS, Security, TLS"],
      ["On-Page Content & Tags", catScore("common"), "Titles, Metas, H1, Hierarchy"],
      ["Structured Schema & Semantic Data", catScore("advanced"), "JSON-LD Organization & Service"],
      ["Mobile & Core Web Vitals", catScore("speed"), "LCP, FID, CLS, PageSpeed"],
      ["Robots & Indexability Directives", catScore("seo"), "Sitemap, Canonical, Robots.txt"],
      [],
      ["EXECUTIVE SUMMARY NOTES"],
      ["• All fixes applied via Auto-Pilot commit directly to production MongoDB models (Seo, Redirect, AdvancedSeo)."],
      ["• Full audit log supports 1-click rollback with exact previous state restoration."],
      ["• Content authenticity scoring incorporates Google EEAT standards for bereavement services."],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows.map(safeRow));
    wsSummary["!cols"] = [{ wch: 38 }, { wch: 32 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary");

    // ─────────────────────────────────────────────────────────────────────────────
    // TAB 2: Auto-Fixed Issues Log
    // ─────────────────────────────────────────────────────────────────────────────
    const fixLogRows = fixLogs.map((log: any, idx: number) => {
      const prevValStr = log.previousValue
        ? typeof log.previousValue === "object"
          ? JSON.stringify(log.previousValue)
          : String(log.previousValue)
        : "(empty)";
      const newValStr = log.newValue
        ? typeof log.newValue === "object"
          ? JSON.stringify(log.newValue)
          : String(log.newValue)
        : "(applied)";

      return {
        "Index": idx + 1,
        "Timestamp": log.createdAt ? new Date(log.createdAt).toLocaleString("en-GB") : "",
        "Route": log.route || "/",
        "Page URL": log.pageUrl || "",
        "Issue Category": (log.issueType || "").toUpperCase(),
        "Fixed By": /^AI Auto-Pilot/i.test(log.fixedBy || "") ? "AUTO_PILOT_AI" : "ADMIN",
        "Actor": log.fixedBy || "",
        "Status": log.reverted || log.status === "reverted" ? "REVERTED" : log.status === "failed" ? "FAILED" : "SUCCESS",
        "Previous State": prevValStr.slice(0, 180),
        "Auto-Fixed State": newValStr.slice(0, 180),
        "Reverted At": log.revertedAt ? new Date(log.revertedAt).toLocaleString("en-GB") : "N/A",
      };
    });

    const wsFixes = fixLogRows.length > 0
      ? XLSX.utils.json_to_sheet(fixLogRows.map(safeObj))
      : XLSX.utils.aoa_to_sheet([["No auto-fixes recorded yet. Use 1-Click Auto-Fix in Admin to heal issues."]]);

    if (fixLogRows.length > 0) {
      wsFixes["!cols"] = [
        { wch: 8 },  // Index
        { wch: 20 }, // Timestamp
        { wch: 25 }, // Route
        { wch: 45 }, // Page URL
        { wch: 18 }, // Issue Category
        { wch: 18 }, // Fixed By
        { wch: 28 }, // Actor
        { wch: 14 }, // Status
        { wch: 45 }, // Previous State
        { wch: 45 }, // Auto-Fixed State
        { wch: 20 }, // Reverted At
      ];
    }
    XLSX.utils.book_append_sheet(wb, wsFixes, "Auto-Fixed Issues Log");

    // ─────────────────────────────────────────────────────────────────────────────
    // TAB 3: Pending Issues
    // ─────────────────────────────────────────────────────────────────────────────
    const pendingRows: any[] = [];

    // Page-level issues, checked against the current database state (resolved fixes are excluded)
    for (const p of pendingState.pending) {
      pendingRows.push({
        "Priority": p.severity === "critical" ? "HIGH" : p.severity === "warning" ? "MEDIUM" : "LOW",
        "Category": p.issueType.toUpperCase(),
        "Check Rule ID": p.issueType,
        "Issue Title": `${p.title} on ${p.route}`,
        "Observed Value": p.currentValue ?? p.imageSrc ?? "(Missing)",
        "Why It Matters": p.detail,
        "Actionable Fix Guide": p.actions.includes("redirect") ? "Create a 301 redirect to the closest live page." : p.actions.includes("override_h1") ? "Set an H1 override for the page." : "Use 1-Click Fix in the SEO audit page.",
      });
    }

    const wsPending = pendingRows.length > 0
      ? XLSX.utils.json_to_sheet(pendingRows.map(safeObj))
      : XLSX.utils.aoa_to_sheet([["No pending SEO issues detected! The site is fully optimized."]]);

    if (pendingRows.length > 0) {
      wsPending["!cols"] = [
        { wch: 12 }, // Priority
        { wch: 18 }, // Category
        { wch: 25 }, // Check Rule ID
        { wch: 40 }, // Issue Title
        { wch: 30 }, // Observed Value
        { wch: 50 }, // Why It Matters
        { wch: 60 }, // Actionable Fix Guide
      ];
    }
    XLSX.utils.book_append_sheet(wb, wsPending, "Pending Issues");

    const resolvedRows = pendingState.resolved.map((p) => ({
      "Route": p.route,
      "Issue": p.issueType.toUpperCase(),
      "Detail": p.imageSrc ?? p.title,
      "Status": "RESOLVED - awaiting website build",
    }));
    XLSX.utils.book_append_sheet(
      wb,
      resolvedRows.length ? XLSX.utils.json_to_sheet(resolvedRows.map(safeObj)) : XLSX.utils.aoa_to_sheet([["No resolved issues are waiting for a website build."]]),
      "Resolved Issues"
    );

    // ─────────────────────────────────────────────────────────────────────────────
    // TAB 4: AI Content & Authenticity Audit
    // ─────────────────────────────────────────────────────────────────────────────
    // Measured facts only. AI-likelihood is NOT estimated here: run the AI Content Inspector for a real model-based score.
    const aiContentRows = crawls.map((c, i) => {
      const totalImages = c.images?.length || 0;
      const missingAlt = c.images?.filter((img) => !img.hasAlt).length || 0;
      return {
        "Index": i + 1,
        "Route Path": c.requestedPath || "/",
        "Total Words": c.wordCount || 0,
        "Heading Hierarchy": c.h1?.length === 1 ? "Valid (Single H1)" : c.h1?.length === 0 ? "Missing H1" : "Multiple H1s",
        "Primary H1 Text": c.h1?.[0] || "(None)",
        "Images Total": totalImages,
        "Images Missing Alt": missingAlt,
        "AI Likelihood Score": "Not measured here (use AI Content Inspector)",
      };
    });

    const wsAi = aiContentRows.length > 0
      ? XLSX.utils.json_to_sheet(aiContentRows.map(safeObj))
      : XLSX.utils.aoa_to_sheet([["No crawled content available yet."]]);

    if (aiContentRows.length > 0) {
      wsAi["!cols"] = [
        { wch: 8 },  // Index
        { wch: 25 }, // Route Path
        { wch: 14 }, // Total Words
        { wch: 20 }, // Heading Hierarchy
        { wch: 35 }, // Primary H1 Text
        { wch: 14 }, // Images Total
        { wch: 18 }, // Images Missing Alt
        { wch: 40 }, // AI Likelihood Score
      ];
    }
    XLSX.utils.book_append_sheet(wb, wsAi, "AI Content & Authenticity");

    // Write to buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return buffer;
  },
};
