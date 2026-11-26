import { existsSync } from "node:fs";
import path from "node:path";
import { label, type Lang } from "./hindi";

let PDFDocumentClass: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  PDFDocumentClass = require("pdfkit");
} catch {
  PDFDocumentClass = null;
}

/*
 * PDF report rendered ONLY from a saved run (canonical report + saved actions). No crawling, no AI here.
 * Hind (OFL) covers both Latin and Devanagari, so English and Hindi use one font family.
 * `tr` maps English AI text → accepted Hindi translation (missing entries stay English, with a note).
 */

const fontPath = (name: string) => {
  const dirs = [path.resolve(__dirname, "../../../../assets/fonts"), path.join(process.cwd(), "assets/fonts"), path.join(process.cwd(), "mokshavoyage_backend/assets/fonts")];
  const f = dirs.map((d) => path.join(d, name)).find((p) => existsSync(p));
  if (!f) throw new Error(`Font ${name} missing from assets/fonts`);
  return f;
};

const C = { ink: "#1e293b", muted: "#64748b", line: "#e2e8f0", brand: "#0f766e", soft: "#f0fdfa", good: "#047857", warn: "#b45309", bad: "#b91c1c" };

export interface PdfInput {
  lang: Lang;
  studyName: string;
  run: { _id: unknown; finishedAt: Date | string | null; report: any };
  actions: { title: string; priority: string; status: string; recommendation: string; source: string }[];
  tr?: Record<string, string>;
  translationNote?: string | null;
}

export function renderReportPdf(input: PdfInput): Promise<Buffer> {
  const { lang, run } = input;
  const r = run.report;
  const L = (s: string) => label(s, lang);
  const T = (s: string | null | undefined) => (s ? (lang === "hi" ? (input.tr?.[s] ?? s) : s) : "");
  if (!PDFDocumentClass) {
    throw new Error("pdfkit is not installed. Please run npm install in backend to enable PDF export.");
  }
  const doc = new PDFDocumentClass({ size: "A4", margins: { top: 48, bottom: 56, left: 46, right: 46 }, bufferPages: true, info: { Title: `${input.studyName} — ${L("Competitor Website Report")}`, Author: "Moksha Voyage" } });
  doc.registerFont("Body", fontPath("Hind-Regular.ttf"));
  doc.registerFont("Bold", fontPath("Hind-Bold.ttf"));
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((ok, fail) => {
    doc.on("end", () => ok(Buffer.concat(chunks)));
    doc.on("error", fail);
  });

  const W = doc.page.width - 92;
  const left = 46;
  const bottom = () => doc.page.height - 70;
  const ensure = (h: number) => {
    if (doc.y + h > bottom()) doc.addPage();
  };
  const text = (s: string, o: { size?: number; bold?: boolean; color?: string; gap?: number; width?: number; x?: number } = {}) => {
    doc.font(o.bold ? "Bold" : "Body").fontSize(o.size ?? 10).fillColor(o.color ?? C.ink).text(s, o.x ?? left, doc.y, { width: o.width ?? W, lineGap: 1.5 });
    if (o.gap) doc.moveDown(o.gap);
  };
  const h1 = (s: string) => {
    ensure(60);
    doc.moveDown(0.6);
    text(s, { size: 15, bold: true, color: C.brand });
    doc.moveTo(left, doc.y + 2).lineTo(left + W, doc.y + 2).strokeColor(C.line).lineWidth(1).stroke();
    doc.moveDown(0.6);
  };
  const h2 = (s: string) => {
    ensure(40);
    doc.moveDown(0.3);
    text(s, { size: 11.5, bold: true });
    doc.moveDown(0.2);
  };
  const bullet = (s: string, color = C.ink) => {
    ensure(20);
    const y = doc.y;
    doc.circle(left + 3, y + 7, 1.8).fill(color);
    text(s, { x: left + 12, width: W - 12, size: 9.5 });
    doc.moveDown(0.15);
  };
  /** Simple table with wrapping cells and automatic page breaks. */
  const table = (headers: string[], rows: (string | number | null)[][], widths: number[], opts: { highlightRow?: (i: number) => boolean } = {}) => {
    const total = widths.reduce((a, b) => a + b, 0);
    const ws = widths.map((w) => (w / total) * W);
    const pad = 4;
    const rowHeight = (cells: string[], bold: boolean) =>
      Math.max(...cells.map((c, i) => doc.font(bold ? "Bold" : "Body").fontSize(8.5).heightOfString(c, { width: ws[i] - pad * 2 }))) + pad * 2;
    const draw = (cells: string[], bold: boolean, fill?: string) => {
      const h = rowHeight(cells, bold);
      if (doc.y + h > bottom()) doc.addPage();
      const y = doc.y;
      if (fill) doc.rect(left, y, W, h).fill(fill);
      let x = left;
      cells.forEach((c, i) => {
        doc.font(bold ? "Bold" : "Body").fontSize(8.5).fillColor(bold ? "#ffffff" : C.ink).text(c, x + pad, y + pad, { width: ws[i] - pad * 2 });
        x += ws[i];
      });
      doc.moveTo(left, y + h).lineTo(left + W, y + h).strokeColor(C.line).lineWidth(0.5).stroke();
      doc.y = y + h;
    };
    draw(headers, true, C.brand);
    rows.forEach((row, i) => draw(row.map((c) => (c === null || c === undefined ? "—" : String(c))), false, opts.highlightRow?.(i) ? C.soft : i % 2 ? "#f8fafc" : undefined));
    doc.x = left;
    doc.moveDown(0.6);
  };

  const sites: any[] = r.sites ?? [];
  const own = sites.find((s) => s.role === "own");
  const comps = sites.filter((s) => s.role === "competitor");
  const fmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

  // ── Cover ────────────────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 210).fill(C.brand);
  doc.font("Bold").fontSize(24).fillColor("#ffffff").text(L("Competitor Website Report"), left, 70, { width: W });
  doc.font("Body").fontSize(13).fillColor("#ccfbf1").text(input.studyName, left, doc.y + 6, { width: W });
  doc.font("Body").fontSize(10).fillColor("#ccfbf1").text(L("Measured website comparison"), left, doc.y + 4, { width: W });
  doc.y = 240;
  table(
    [L("Your website"), L("Competitors"), L("Report date"), L("Evidence quality")],
    [[own?.domain ?? "—", comps.map((c) => c.domain).join(", "), fmt(run.finishedAt), `${r.quality?.status ?? "—"} (${r.quality?.completeness ?? "—"}%)`]],
    [2, 4, 1.6, 1.6],
  );
  text(L("Scores measure the public website only - not service quality, traffic, rankings or business results."), { size: 9, color: C.muted, gap: 0.5 });
  if (input.translationNote) text(input.translationNote, { size: 9, color: C.warn, gap: 0.5 });

  // ── Summary + overall scores ────────────────────────────────────────────────
  h1(L("Summary"));
  if (r.ai?.result?.summary) text(T(r.ai.result.summary), { size: 10.5, gap: 0.6 });
  else text(L("AI analysis was not available for this check; only measured data is shown."), { size: 10, color: C.warn, gap: 0.6 });
  table(
    ["", L("Overall score (out of 100)"), L("Weight scored"), L("Pages read")],
    sites.map((s) => [`${s.siteName ?? s.domain}${s.role === "own" ? " ★" : ""}\n${s.domain}`, s.score?.overall ?? L("not scored"), `${Math.round((s.score?.scoredWeight ?? 0) * 100)}%`, `${s.coverage?.read ?? 0}/${s.coverage?.selected ?? 0}`]),
    [4, 2, 1.5, 1.5],
    { highlightRow: (i) => sites[i]?.role === "own" },
  );

  h2(L("Who leads in each area"));
  table(
    [L("Area"), own?.domain ?? "", L("Leader")],
    (r.leaders ?? []).map((l: any) => [L(l.label), l.scores?.[own?.domain] ?? L("not scored"), Object.keys(l.scores ?? {}).length < 2 ? L("not comparable") : l.tie ? L("tie") : l.leader]),
    [3, 1.3, 2.5],
  );

  // ── Scorecard ───────────────────────────────────────────────────────────────
  h1(L("Scorecard"));
  const cats: any[] = own?.score?.categories ?? [];
  table([L("Area"), ...sites.map((s) => s.domain)], cats.map((c) => [L(c.label), ...sites.map((s) => s.score?.categories?.find((x: any) => x.category === c.category)?.score ?? "—")]), [3, ...sites.map(() => 1.2)]);

  // ── Head to head ────────────────────────────────────────────────────────────
  const h2h: any[] = comps.map((c) => {
    const ai = r.ai?.result?.headToHead?.find((h: any) => h.competitor === c.domain);
    return ai && (ai.ownLeads?.length || ai.competitorLeads?.length) ? ai : r.measuredHeadToHead?.find((h: any) => h.competitor === c.domain) ?? ai;
  }).filter(Boolean);
  if (h2h.length) {
    h1(L("Head to head"));
    for (const h of h2h) {
      h2(`${own?.domain} vs ${h.competitor}`);
      text(L("Where you lead"), { bold: true, size: 9.5, color: C.good });
      for (const c of h.ownLeads ?? []) bullet(`${T(c.text)}  "${c.evidence?.[0]?.quote ?? ""}" (${c.evidence?.[0]?.url ?? ""})`, C.good);
      text(L("Where they lead"), { bold: true, size: 9.5, color: C.bad });
      for (const c of h.competitorLeads ?? []) bullet(`${T(c.text)}  "${c.evidence?.[0]?.quote ?? ""}" (${c.evidence?.[0]?.url ?? ""})`, C.bad);
      if (h.verdict) text(T(h.verdict), { size: 9.5, color: C.muted, gap: 0.4 });
    }
  }

  // ── Services + prices ───────────────────────────────────────────────────────
  h1(L("Services seen on each website"));
  const state = (st: string) => (st === "present" ? L("Yes") : st === "absent_confirmed" ? L("Absent") : L("Not seen"));
  table(["", ...sites.map((s) => s.domain)], (own?.services ?? []).map((sv: any) => [sv.label, ...sites.map((s) => state(s.services?.find((x: any) => x.category === sv.category)?.state ?? "not_observed"))]), [3, ...sites.map(() => 1.2)]);
  h2(L("Published prices"));
  for (const s of sites) {
    text(s.domain, { bold: true, size: 9.5 });
    if (!s.prices?.length) text(L("No published price seen in the pages read."), { size: 9, color: C.muted });
    for (const p of (s.prices ?? []).slice(0, 8)) bullet(`${p.raw}${p.startingFrom ? " (starting from)" : ""}${p.unit ? ` / ${p.unit}` : ""} — “${p.excerpt}”  ${p.sourceUrl}`);
    doc.moveDown(0.3);
  }

  // ── Website up close + speed ────────────────────────────────────────────────
  h1(L("Website up close"));
  table(
    ["", L("Pages read"), "Words", "Images (alt)", "Sitemap (30d / 90d)", L("Mobile performance"), L("Brand known to Google")],
    sites.map((s) => [
      s.domain,
      s.upClose?.pagesRead ?? s.coverage?.read ?? "—",
      s.upClose?.words ?? "—",
      s.upClose ? `${s.upClose.images} (${s.upClose.imagesWithAlt})` : "—",
      s.sitemap?.found ? `${s.sitemap.entryCount} · ${s.sitemap.recent30 ?? "—"} / ${s.sitemap.recent90 ?? "—"}` : "none",
      s.speed?.mobile?.performance ?? s.speed?.state ?? "—",
      s.brand?.state ?? "—",
    ]),
    [2.4, 1, 1, 1.2, 1.6, 1.3, 1.4],
  );

  // ── Gaps + actions ──────────────────────────────────────────────────────────
  const gaps: any[] = r.ai?.result?.gaps ?? [];
  if (gaps.length) {
    h1(L("Content gaps"));
    for (const g of gaps) bullet(`${T(g.title)} — ${T(g.detail)}`);
  }
  h1(L("Action plan"));
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const acts = input.actions.filter((a) => a.status !== "rejected").sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3)).slice(0, 15);
  table([L("Priority"), "", ""], acts.map((a) => [L(a.priority), T(a.title), T(a.recommendation)]), [1, 3, 5]);

  // ── Changes ─────────────────────────────────────────────────────────────────
  h1(L("Changes since the previous check"));
  if (!r.changes) text(L("No previous check to compare with."), { size: 9.5, color: C.muted });
  else {
    const all = r.changes.flatMap((c: any) => (c.diff?.changes ?? []).map((x: any) => `${c.domain}: ${x.kind.replace(/_/g, " ")} — ${String(x.subject).slice(0, 100)}`));
    if (!all.length) text(L("No evidence-backed changes."), { size: 9.5, color: C.muted });
    for (const line of all.slice(0, 30)) bullet(line);
  }

  // ── Method + sources ────────────────────────────────────────────────────────
  h1(L("Method and limits"));
  for (const l of r.limitations ?? []) bullet(l, C.muted);
  for (const m of r.methodology?.rules ?? []) bullet(m, C.muted);
  text(`Rubric ${r.methodology?.rubricVersion ?? ""} · checks ${r.methodology?.checkCount ?? ""} · settings v${r.methodology?.settingsVersion ?? 0}`, { size: 8.5, color: C.muted, gap: 0.5 });
  h2(L("Sources"));
  const urls = new Set<string>();
  for (const h of h2h) for (const c of [...(h.ownLeads ?? []), ...(h.competitorLeads ?? [])]) for (const e of c.evidence ?? []) urls.add(e.url);
  for (const g of gaps) for (const e of g.evidence ?? []) urls.add(e.url);
  for (const s of sites) for (const p of s.prices ?? []) urls.add(p.sourceUrl);
  for (const u of [...urls].slice(0, 60)) text(u, { size: 8, color: C.muted });

  // ── Footer with page numbers ────────────────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // writing inside the bottom margin must not add a page
    doc.font("Body").fontSize(7.5).fillColor(C.muted).text(`Moksha Voyage · ${input.studyName} · ${L("Page")} ${i + 1}/${range.count}`, left, doc.page.height - 40, { width: W, align: "center", lineBreak: false });
  }
  doc.end();
  return done;
}
