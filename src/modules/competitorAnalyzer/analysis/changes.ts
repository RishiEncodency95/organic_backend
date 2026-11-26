import type { SiteCrawl } from "../crawler/crawler";
import type { EvidenceState, FeatureKey, SiteEvidence } from "../evidence/evidence";
import type { SiteScore } from "./scoring";
import type { SpeedResult } from "../providers/pagespeed";

/*
 * Engine 14 — change monitoring. Compares two immutable per-site snapshots. Only evidence-backed transitions are
 * reported as changes; transitions caused by a failed fetch, a page not sampled this time, or a provider being
 * unavailable are reported separately as "not comparable", never as removals.
 */

export interface SnapshotForDiff {
  crawl: Pick<SiteCrawl, "state" | "pages" | "crawlerVersion">;
  evidence: Pick<SiteEvidence, "features" | "services" | "prices">;
  score: Pick<SiteScore, "overall" | "categories" | "rubricVersion"> | null;
  speed: Pick<SpeedResult, "state" | "mobile"> | null;
}

export type ChangeKind = "page_added" | "page_removed" | "page_content_changed" | "title_changed" | "h1_changed" | "meta_changed" | "feature_added" | "feature_removed" | "service_added" | "service_removed" | "price_added" | "price_removed" | "score_changed" | "speed_changed";

export interface SiteChange {
  kind: ChangeKind;
  subject: string;
  before: string | number | null;
  after: string | number | null;
  url: string | null;
}

export interface SiteDiff {
  comparable: boolean;
  reason: string | null;
  changes: SiteChange[];
  notComparable: { subject: string; reason: string }[];
}

const definitive = (s: EvidenceState) => s === "present" || s === "absent_confirmed";

export function diffSnapshots(prev: SnapshotForDiff, curr: SnapshotForDiff): SiteDiff {
  const out: SiteDiff = { comparable: true, reason: null, changes: [], notComparable: [] };
  if (prev.crawl.state !== "ok" || curr.crawl.state !== "ok") {
    return { comparable: false, reason: `Crawl state previous=${prev.crawl.state}, current=${curr.crawl.state}; changes not assessed.`, changes: [], notComparable: [] };
  }
  const index = (pages: SnapshotForDiff["crawl"]["pages"]) => new Map(pages.map((p) => [p.url, p]));
  const a = index(prev.crawl.pages);
  const b = index(curr.crawl.pages);
  for (const [url, pb] of b) {
    const pa = a.get(url);
    if (!pa) {
      if (pb.state === "read") out.changes.push({ kind: "page_added", subject: pb.extract?.title ?? url, before: null, after: url, url });
      continue;
    }
    if (pa.state === "read" && pb.state === "http_error" && (pb.httpStatus === 404 || pb.httpStatus === 410)) {
      out.changes.push({ kind: "page_removed", subject: pa.extract?.title ?? url, before: url, after: `HTTP ${pb.httpStatus}`, url });
      continue;
    }
    if (pa.state !== "read" || pb.state !== "read" || !pa.extract || !pb.extract) {
      if (pa.state === "read" || pb.state === "read") out.notComparable.push({ subject: url, reason: `Page state ${pa.state} → ${pb.state}` });
      continue;
    }
    if ((pa.extract.title ?? "") !== (pb.extract.title ?? "")) out.changes.push({ kind: "title_changed", subject: url, before: pa.extract.title, after: pb.extract.title, url });
    const h1a = pa.extract.headings.find((h) => h.level === 1)?.text ?? null;
    const h1b = pb.extract.headings.find((h) => h.level === 1)?.text ?? null;
    if (h1a !== h1b) out.changes.push({ kind: "h1_changed", subject: url, before: h1a, after: h1b, url });
    if ((pa.extract.metaDescription ?? "") !== (pb.extract.metaDescription ?? "")) out.changes.push({ kind: "meta_changed", subject: url, before: pa.extract.metaDescription, after: pb.extract.metaDescription, url });
    if (pa.extract.contentHash !== pb.extract.contentHash) out.changes.push({ kind: "page_content_changed", subject: url, before: pa.extract.wordCount, after: pb.extract.wordCount, url });
  }
  for (const [url, pa] of a) {
    if (!b.has(url) && pa.state === "read") out.notComparable.push({ subject: url, reason: "Not sampled in the current run" });
  }

  for (const key of Object.keys(curr.evidence.features) as FeatureKey[]) {
    const fa = prev.evidence.features[key];
    const fb = curr.evidence.features[key];
    if (!fa || !fb || fa.state === fb.state) continue;
    if (definitive(fa.state) && definitive(fb.state)) {
      out.changes.push({ kind: fb.state === "present" ? "feature_added" : "feature_removed", subject: key, before: fa.state, after: fb.state, url: fb.evidence[0]?.url ?? fa.evidence[0]?.url ?? null });
    } else if (fa.state === "present" || fb.state === "present") {
      out.notComparable.push({ subject: key, reason: `${fa.state} → ${fb.state} (not a confirmed change)` });
    }
  }
  const svc = (e: SnapshotForDiff["evidence"]) => new Set(e.services.filter((s) => s.state === "present").map((s) => s.category));
  const sa = svc(prev.evidence);
  const sb = svc(curr.evidence);
  for (const s of sb) if (!sa.has(s)) out.changes.push({ kind: "service_added", subject: s, before: null, after: "present", url: curr.evidence.services.find((x) => x.category === s)?.evidence[0]?.url ?? null });
  for (const s of sa) if (!sb.has(s)) out.notComparable.push({ subject: `service:${s}`, reason: "Previously evidenced; not observed in this sample (not confirmed removed)" });

  const priceKey = (p: SnapshotForDiff["evidence"]["prices"][number]) => `${p.sourceUrl}|${p.raw}`;
  const pa = new Map(prev.evidence.prices.map((p) => [priceKey(p), p]));
  const pb = new Map(curr.evidence.prices.map((p) => [priceKey(p), p]));
  const readNow = new Set(curr.crawl.pages.filter((p) => p.state === "read").map((p) => p.finalUrl ?? p.url));
  for (const [k, p] of pb) if (!pa.has(k)) out.changes.push({ kind: "price_added", subject: p.raw, before: null, after: p.excerpt, url: p.sourceUrl });
  for (const [k, p] of pa) {
    if (pb.has(k)) continue;
    if (readNow.has(p.sourceUrl)) out.changes.push({ kind: "price_removed", subject: p.raw, before: p.excerpt, after: null, url: p.sourceUrl });
    else out.notComparable.push({ subject: `price:${p.raw}`, reason: "Source page not read in this run" });
  }

  if (prev.score && curr.score) {
    if (prev.score.rubricVersion !== curr.score.rubricVersion) out.notComparable.push({ subject: "score", reason: `Rubric changed ${prev.score.rubricVersion} → ${curr.score.rubricVersion}` });
    else if (prev.score.overall !== null && curr.score.overall !== null && prev.score.overall !== curr.score.overall) out.changes.push({ kind: "score_changed", subject: "overall", before: prev.score.overall, after: curr.score.overall, url: null });
  }
  if (prev.speed?.state === "measured" && curr.speed?.state === "measured" && prev.speed.mobile && curr.speed.mobile) {
    const x = prev.speed.mobile.performance;
    const y = curr.speed.mobile.performance;
    if (x !== null && y !== null && Math.abs(x - y) >= 5) out.changes.push({ kind: "speed_changed", subject: "mobile performance", before: x, after: y, url: null });
  } else if (prev.speed?.state === "measured" || curr.speed?.state === "measured") {
    out.notComparable.push({ subject: "speed", reason: `PageSpeed ${prev.speed?.state ?? "none"} → ${curr.speed?.state ?? "none"}` });
  }
  return out;
}
