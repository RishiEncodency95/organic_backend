/**
 * Competitor Intelligence Report — PDF renderer (pdfkit, built-in Helvetica, vector charts; no browser, no network).
 *
 * Cover, executive summary, scorecard (heatmap + radar), head-to-head, SWOT, topics & content, speed & tech, a 90-day
 * roadmap with the action plan, website profiles, KPIs and the method. Every number comes from the saved analysis;
 * characters outside Latin-1 cannot be drawn with the built-in font and are replaced. The Hindi version uses the bundled
 * Hind font (Devanagari + Latin) and translates the report's own labels through `analyzer-hindi`.
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import { hindiLabel, label, profileLabel, type ReportLang } from './analyzer-hindi';
import type { AnalyzerResult } from './analyzer-ai';
import type { SiteChange } from './analyzer-changes';
import type { SiteEvidence } from './analyzer-evidence';
import type { ReportNarrative } from './analyzer-report';
import type { AnalysisQuality } from './analyzer-intelligence';
import { OFFER_FIELDS, hasOffers, type OfferField, type OffersBlock } from './analyzer-offers';
import type { evaluateProfile } from './profiles';
import type { BusinessIntelligence } from './business-intelligence';

export interface AnalyzerPdfInput {
  businessIntelligence?:BusinessIntelligence|null;
  brandName?:string;
  profileResults?: ReturnType<typeof evaluateProfile>;
  studyName: string;
  preparedFor: string;
  /** The company's report logo (PNG or JPEG), drawn on the cover. */
  logo?: Buffer | null;
  generatedAt: Date;
  checkedAt: Date;
  sites: { url: string; domain: string; role: 'own' | 'competitor' }[];
  evidence: SiteEvidence[];
  quality?: AnalysisQuality;
  businessThreat?: { status: 'not_assessed'; message: string };
  canonicalSummary?: string;
  ai: AnalyzerResult | null;
  aiNote: string | null;
  narrative: ReportNarrative | null;
  changes: SiteChange[] | null;
  /** Prices, packages and event facts with their quotes (checks from 2026-10-23 on). */
  offers?: OffersBlock | null;
  /** 'hi' draws the report in Hindi; the caller passes already-translated analysis text. */
  lang?: ReportLang;
}

/** backend/assets/fonts, from src/ or dist/ or the backend folder as working directory. */
function fontFile(name: string) {
  const dirs = [resolve(__dirname, '../../../assets/fonts'), resolve(__dirname, '../../../../assets/fonts'), join(process.cwd(), 'assets/fonts'), join(process.cwd(), 'organic_backend/assets/fonts')];
  const found = dirs.map((d) => join(d, name)).find((f) => existsSync(f));
  if (!found) throw new Error(`Font ${name} is missing from backend/assets/fonts.`);
  return found;
}

const W = 595.28;
const H = 841.89;
const M = 42;
const CW = W - M * 2;
const TOP = 76;
const BOTTOM = H - 58;

const NAVY = '#0F1A38';
const INDIGO = '#1E2F6B';
const VIOLET = '#4C1D95';
const BRAND = '#2563EB';
const INK = '#111C3A';
const BODY = '#28354C';
const MUTED = '#5B6B85';
const FAINT = '#94A3B8';
const LINE = '#E3E8F1';
const PANEL = '#F5F8FD';
const GOOD = '#0B845C';
const WARN = '#B45309';
const BAD = '#C0261F';
const GOLD = '#F59E0B';
/** Tint behind everything that is about your own website. */
const OWN_TINT = '#E8F0FE';
const SITE = ['#2563EB', '#12A06D', '#E29208', '#7C3AED', '#DC3A32'];

const AREA_MEANING: Record<string, string> = {
  'Message clarity': 'Can a visitor tell within seconds who you are, what you offer and for whom?',
  'Trust & proof': 'Testimonials, numbers, awards, partners, certificates - reasons to believe you.',
  'Calls to action': 'Clear buttons and next steps: register, book, contact, donate.',
  'Content depth': 'How much genuinely useful information the pages give.',
  'Ease of contact': 'Phone, WhatsApp, email and forms that are easy to find.',
  'Search basics': 'Titles, descriptions, headings and technical tags Google needs.',
  'Speed & mobile': 'How fast and comfortable the site is on a phone.',
};

/** "bharatorganicexpo.com" -> "bharatorganicexpo" for narrow column headers. */
const shortName = (d: string) => {
  const base = d.split('.')[0] ?? d;
  return base.length > 15 ? `${base.slice(0, 14)}…` : base;
};
const scoreColor = (v: number | null | undefined) => (v == null ? FAINT : v >= 70 ? GOOD : v >= 45 ? WARN : BAD);

export async function renderAnalyzerPdf(input: AnalyzerPdfInput): Promise<Buffer> {
  const quality = input.quality ?? { status: 'partial' as const, score: 0, issues: [], rule: 'No evidence = not verified' as const };
  const own = input.sites[0]!;
  const ai = input.ai;
  const n = input.narrative;
  const colorOf = (d: string) => SITE[Math.max(0, input.sites.findIndex((s) => s.domain === d)) % SITE.length]!;
  const ev = (d: string) => input.evidence.find((e) => e.domain === d);
  const ranked = ai ? [...input.sites].sort((a, b) => (ai.overall[b.domain] ?? -1) - (ai.overall[a.domain] ?? -1)) : input.sites;
  const rankOf = (d: string) => (ai && ai.overall[d] !== undefined ? Object.values(ai.overall).filter((v) => v > ai.overall[d]!).length + 1 : null);
  const ownScore = ai?.overall[own.domain] ?? null;
  const ownRank = rankOf(own.domain);
  const tied = ai && ownScore != null ? input.sites.filter((s) => s.domain !== own.domain && ai.overall[s.domain] === ownScore).map((s) => s.domain) : [];
  const hi = input.lang === 'hi';
  /** A templated label in the report's language, e.g. L('Tied with {x}', { x: 'a.com' }). */
  const L = (en: string, vars: Record<string, string | number> = {}) => label(input.lang ?? 'en', en, vars);
  const fmtDate = (d: Date) => d.toLocaleDateString(hi ? 'hi-IN' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

  /** Text as drawn: fixed labels are translated for Hindi, and characters the font cannot draw are replaced. */
  const safe = (v: unknown): string => {
    let out = '';
    const raw = String(v ?? '');
    for (const ch of hi ? hindiLabel(raw) ?? raw : raw) {
      const c = ch.codePointAt(0)!;
      if (hi && ((c >= 0x0900 && c <= 0x097f) || c === 0x200c || c === 0x200d)) out += ch;
      else if (c === 10 || (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || [0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026].includes(c)) out += ch;
      else if (c === 0x20b9) out += 'Rs.';
      else if (c === 0x2192) out += '->';
      else if (c === 0x2190) out += '<-';
      else if (c === 0x2713 || c === 0x2714) out += 'Yes';
      else if (c === 0x2264) out += '<=';
      else if (c === 0x2265) out += '>=';
      else out += ' ';
    }
    return out;
  };

  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, info: { Title: `Competitor Intelligence Report - ${own.domain}`, Author: input.brandName ?? 'Media360', Subject: input.studyName, CreationDate: input.generatedAt } });
  if (hi) {
    doc.registerFont('Body', fontFile('Hind-Regular.ttf'));
    doc.registerFont('BodyBold', fontFile('Hind-Bold.ttf'));
  }
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  /* ---------------- primitives ---------------- */
  const font = (bold = false, size = 9.5, color = BODY, italic = false) =>
    doc.font(hi ? (bold ? 'BodyBold' : 'Body') : bold ? (italic ? 'Helvetica-BoldOblique' : 'Helvetica-Bold') : italic ? 'Helvetica-Oblique' : 'Helvetica').fontSize(size).fillColor(color);
  const textH = (t: string, w: number, size = 9.5, bold = false, lineGap = 1.5) => {
    font(bold, size);
    return doc.heightOfString(safe(t), { width: w, lineGap });
  };
  const text = (t: string, x: number, y: number, w: number, o: { size?: number; bold?: boolean; color?: string; italic?: boolean; align?: 'left' | 'center' | 'right'; lineGap?: number; height?: number; spacing?: number } = {}) => {
    font(o.bold, o.size ?? 9.5, o.color ?? BODY, o.italic);
    doc.text(safe(t), x, y, { width: w, align: o.align ?? 'left', lineGap: o.lineGap ?? 1.5, height: o.height, ellipsis: o.height ? true : undefined, characterSpacing: hi ? undefined : o.spacing });
    return doc.y;
  };
  const newPage = () => {
    doc.addPage();
    doc.y = TOP;
  };
  const ensure = (h: number) => {
    if (doc.y + h > BOTTOM) newPage();
  };
  const pill = (label: string, x: number, y: number, bg: string, fg: string, size = 7) => {
    font(true, size);
    const w = doc.widthOfString(safe(label)) + 12;
    doc.roundedRect(x, y, w, size + 7, (size + 7) / 2).fill(bg);
    text(label, x + 6, y + 3.4, w, { size, bold: true, color: fg });
    return w;
  };
  const dot = (x: number, y: number, r: number, color: string) => doc.circle(x, y, r).fill(color);
  const bulletsH = (items: string[], w: number, size = 9) => items.reduce((h, t) => h + textH(t, w - 12, size) + 4, 0);
  const bullets = (items: string[], x: number, y: number, w: number, color: string, size = 9) => {
    let cy = y;
    for (const t of items) {
      dot(x + 3, cy + size / 2 + 0.5, 2, color);
      cy = text(t, x + 12, cy, w - 12, { size }) + 4;
    }
    return cy;
  };
  const ring = (cx: number, cy: number, r: number, value: number | null, width: number, track = '#E8EDF5', label?: { size: number; color: string }, trackOpacity = 1) => {
    doc.strokeOpacity(trackOpacity).lineWidth(width).strokeColor(track).circle(cx, cy, r).stroke().strokeOpacity(1);
    if (value != null && value > 0) {
      const sweep = Math.min(value, 99.9) / 100 * Math.PI * 2;
      const a0 = -Math.PI / 2;
      const a1 = a0 + sweep;
      const x0 = cx + r * Math.cos(a0);
      const y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1);
      const y1 = cy + r * Math.sin(a1);
      doc.lineWidth(width).lineCap('round').strokeColor(scoreColor(value)).path(`M ${x0} ${y0} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x1} ${y1}`).stroke();
      doc.lineCap('butt');
    }
    if (label) text(value == null ? '-' : String(value), cx - r, cy - label.size / 2 - 1, r * 2, { size: label.size, bold: true, color: label.color, align: 'center' });
  };

  /** A section opens on a new page: number, title and a plain-language line on how to read it. */
  const section = (num: number, title: string, intro: string) => {
    newPage();
    doc.circle(M + 13, doc.y + 13, 13).fill(BRAND);
    text(String(num), M, doc.y + 6.5, 26, { size: 11, bold: true, color: '#FFFFFF', align: 'center' });
    text(title, M + 36, TOP + 3, CW - 36, { size: 19, bold: true, color: INK });
    doc.y = TOP + 34;
    const h = textH(intro, CW - 24, 9);
    doc.roundedRect(M, doc.y, CW, h + 14, 6).fill('#EEF3FD');
    doc.rect(M, doc.y, 3, h + 14).fill(BRAND);
    text(intro, M + 14, doc.y + 7, CW - 24, { size: 9, color: BODY });
    doc.y += 14 + 14;
  };
  const sub = (title: string, next = 40) => {
    ensure(next);
    text(title.toUpperCase(), M, doc.y, CW, { size: 8, bold: true, color: MUTED, spacing: 0.8 });
    doc.moveTo(M, doc.y + 3).lineTo(M + CW, doc.y + 3).lineWidth(0.6).strokeColor(LINE).stroke();
    doc.y += 10;
  };

  /* ================= cover ================= */
  {
    const g = doc.linearGradient(0, 0, W, H);
    g.stop(0, NAVY).stop(0.55, INDIGO).stop(1, VIOLET);
    doc.rect(0, 0, W, H).fill(g);
    doc.fillOpacity(0.06).circle(W - 40, 90, 190).fill('#FFFFFF').circle(80, H - 60, 150).fill('#FFFFFF').fillOpacity(1);
    doc.fillOpacity(0.18).circle(W - 130, H - 230, 120).fill('#7C3AED').fillOpacity(1);

    if (input.logo) {
      try {
        doc.roundedRect(M, 40, 150, 56, 10).fill('#FFFFFF');
        doc.image(input.logo, M + 10, 46, { fit: [130, 44], align: 'center', valign: 'center' });
      } catch {
        text(input.brandName ?? 'MEDIA360', M, 58, CW, { size: 8.5, bold: true, color: '#C7D2FE', spacing: 2 });
      }
    } else {
      text(input.brandName ?? 'MEDIA360', M, 58, CW, { size: 8.5, bold: true, color: '#C7D2FE', spacing: 2 });
    }
    text('COMPETITOR INTELLIGENCE REPORT', M, 150, CW, { size: 11, bold: true, color: '#A5B4FC', spacing: 2.5 });
    text(own.domain, M, 172, CW, { size: 30, bold: true, color: '#FFFFFF' });
    text(L(input.sites.length > 2 ? 'compared with {n} competitor websites' : 'compared with {n} competitor website', { n: input.sites.length - 1 }), M, doc.y + 2, CW, { size: 13, color: '#E0E7FF' });
    if (n?.headline) {
      doc.rect(M, doc.y + 22, 3, textH(n.headline, CW - 20, 13, false) + 4).fill(GOLD);
      text(n.headline, M + 16, doc.y + 22, CW - 20, { size: 13, italic: true, color: '#FFFFFF', lineGap: 3 });
    }

    // Score ring and position.
    const cy = 470;
    doc.fillOpacity(0.1).roundedRect(M, cy - 90, CW, 180, 14).fill('#FFFFFF').fillOpacity(1);
    ring(M + 95, cy, 58, ownScore, 12, '#FFFFFF', { size: 34, color: '#FFFFFF' }, 0.2);
    text('OVERALL SCORE', M + 37, cy + 22, 116, { size: 7.5, bold: true, color: '#C7D2FE', align: 'center', spacing: 1 });
    const px = M + 190;
    text('YOUR POSITION', px, cy - 62, CW - 200, { size: 8, bold: true, color: '#C7D2FE', spacing: 1.5 });
    text(ownRank ? L('#{r} of {n}', { r: ownRank, n: input.sites.length }) : 'Not scored', px, cy - 48, CW - 200, { size: 34, bold: true, color: '#FFFFFF' });
    if (tied.length) text(L('Tied with {x}', { x: tied.join(', ') }), px, doc.y, CW - 200, { size: 9.5, color: '#FDE68A' });
    const leads = ai?.scores.filter((s) => s.leader === own.domain).length ?? 0;
    const quick = ai?.actions.filter((a) => a.effort === 'low' && (a.impact ?? a.priority) === 'high').length ?? 0;
    const stats: [string, string][] = [
      ['Areas you lead', ai ? L('{a} of {b}', { a: leads, b: ai.scores.length }) : '-'],
      ['Quick wins', ai ? String(quick) : '-'],
      ['Pages read', String(input.evidence.reduce((s, e) => s + e.pages.length, 0))],
    ];
    stats.forEach(([k, v], i) => {
      const sx = px + i * 112;
      text(v, sx, cy + 26, 110, { size: 17, bold: true, color: '#FFFFFF' });
      text(k.toUpperCase(), sx, cy + 48, 110, { size: 7, bold: true, color: '#C7D2FE', spacing: 0.8 });
    });

    // Compared websites.
    let ly = 600;
    text('WEBSITES IN THIS REPORT', M, ly, CW, { size: 8, bold: true, color: '#C7D2FE', spacing: 1.5 });
    ly += 16;
    ranked.forEach((s, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = M + col * (CW / 2);
      const y = ly + row * 20;
      dot(x + 4, y + 5, 4, colorOf(s.domain));
      text(s.role === 'own' ? L('{d}  (you)', { d: s.domain }) : s.domain, x + 14, y, CW / 2 - 60, { size: 10, bold: s.role === 'own', color: '#FFFFFF', height: 13 });
      text(ai?.overall[s.domain] != null ? String(ai.overall[s.domain]) : '-', x + CW / 2 - 50, y, 30, { size: 10, bold: true, color: '#FFFFFF', align: 'right' });
    });

    doc.moveTo(M, H - 92).lineTo(W - M, H - 92).lineWidth(0.6).strokeColor('#6366F1').stroke();
    text(L('Prepared for {x}', { x: input.preparedFor }), M, H - 80, CW / 2, { size: 9.5, bold: true, color: '#FFFFFF' });
    text(L('Websites checked {x}', { x: fmtDate(input.checkedAt) }), M, H - 66, CW / 2, { size: 8.5, color: '#C7D2FE' });
    text(L('Report generated {x}', { x: fmtDate(input.generatedAt) }), W / 2, H - 80, CW / 2, { size: 8.5, color: '#C7D2FE', align: 'right' });
    text('Confidential - for internal planning', W / 2, H - 66, CW / 2, { size: 8.5, color: '#C7D2FE', align: 'right' });
  }

  /* ================= 1. executive summary ================= */
  let num = 0;
  section(++num, 'Executive summary', 'Where your website stands against the competitors, in plain words. Scores are out of 100 and come from the public pages that were read and Google measurements - not from traffic or sales, which are not public.');
  {
    const summary = input.canonicalSummary ?? n?.executiveSummary ?? ai?.overview ?? input.aiNote ?? 'The comparison did not complete for this check, so only measured data is shown in this report.';
    ensure(textH(summary, CW, 11, false, 3) + 10);
    doc.y = text(summary, M, doc.y, CW, { size: 11, color: INK, lineGap: 3 }) + 14;
    if (quality.status !== 'verified') {
      const warning = quality.status === 'needs_review' ? 'NEEDS REVIEW' : 'PARTIAL EVIDENCE';
      const detail = `${warning}: ${quality.issues.map((issue) => issue.message).slice(0, 3).join(' ') || 'This legacy report does not include crawl-confidence metadata.'}`;
      ensure(textH(detail, CW - 20, 8.5, false, 2) + 18);
      const y = doc.y;
      doc.roundedRect(M, y, CW, textH(detail, CW - 20, 8.5, false, 2) + 14, 6).fill('#FFFBEB');
      text(detail, M + 10, y + 7, CW - 20, { size: 8.5, bold: true, color: '#92400E', lineGap: 2 });
      doc.y += textH(detail, CW - 20, 8.5, false, 2) + 22;
    }

    // KPI cards.
    const cards: [string, string, string, string][] = [
      ['Overall score', ownScore != null ? String(ownScore) : '-', 'out of 100', scoreColor(ownScore)],
      ['Your rank', ownRank ? `#${ownRank}` : '-', L(tied.length ? 'of {n} websites (tied)' : 'of {n} websites', { n: input.sites.length }), BRAND],
      ['Areas you lead', ai ? `${ai.scores.filter((s) => s.leader === own.domain).length}/${ai.scores.length}` : '-', 'highest score in the area', GOOD],
      ['Quick wins', ai ? String(ai.actions.filter((a) => a.effort === 'low' && (a.impact ?? a.priority) === 'high').length) : '-', 'high impact, low effort', '#7C3AED'],
    ];
    const cw4 = (CW - 3 * 10) / 4;
    ensure(72);
    const cy = doc.y;
    cards.forEach(([label, value, hint, color], i) => {
      const x = M + i * (cw4 + 10);
      doc.roundedRect(x, cy, cw4, 64, 8).fill(PANEL);
      doc.roundedRect(x, cy, 4, 64, 2).fill(color);
      text(label.toUpperCase(), x + 12, cy + 9, cw4 - 18, { size: 7, bold: true, color: MUTED, spacing: 0.6 });
      text(value, x + 12, cy + 21, cw4 - 18, { size: 22, bold: true, color });
      text(hint, x + 12, cy + 48, cw4 - 18, { size: 7.5, color: FAINT, height: 10 });
    });
    doc.y = cy + 64 + 18;

    // Leaderboard.
    sub('Leaderboard');
    for (const s of ranked) {
      ensure(24);
      const y = doc.y;
      const score = ai?.overall[s.domain] ?? null;
      const rank = rankOf(s.domain);
      if (s.role === 'own') doc.roundedRect(M - 6, y - 4, CW + 12, 22, 6).fill(OWN_TINT);
      doc.circle(M + 9, y + 7, 9).fill(rank === 1 ? GOLD : '#E8EDF5');
      text(rank ? String(rank) : '-', M, y + 3, 18, { size: 8.5, bold: true, color: rank === 1 ? '#FFFFFF' : INK, align: 'center' });
      text(s.domain, M + 26, y + 2, 170, { size: 9.5, bold: s.role === 'own', color: INK, height: 12 });
      if (s.role === 'own') pill('YOU', M + 26 + Math.min(165, doc.widthOfString(safe(s.domain)) + 6), y + 1, BRAND, '#FFFFFF', 6.5);
      const bx = M + 230;
      const bw = CW - 230 - 36;
      doc.roundedRect(bx, y + 4, bw, 7, 3.5).fill('#EEF2F8');
      if (score) doc.roundedRect(bx, y + 4, Math.max(7, (bw * score) / 100), 7, 3.5).fill(colorOf(s.domain));
      text(score != null ? String(score) : '-', M + CW - 30, y + 1, 30, { size: 11, bold: true, color: INK, align: 'right' });
      doc.y = y + 22;
    }
    doc.y += 8;

    // Biggest threat.
    const threat = ai?.headToHead.find((h) => h.threat === 'high') ?? ai?.headToHead.find((h) => h.threat === 'medium');
    if (threat) {
      const body = threat.threatReason || threat.verdict;
      const h = textH(body, CW - 30, 9.5) + 34;
      ensure(h + 10);
      const ty = doc.y;
      doc.roundedRect(M, ty, CW, h, 8).fill('#FEF2F2');
      doc.rect(M, ty, 4, h).fill(BAD);
      text(hi ? L('biggest threat: {x}', { x: threat.competitor }) : `WEBSITE PRESSURE: ${threat.competitor.toUpperCase()}`, M + 16, ty + 10, CW - 30, { size: 8.5, bold: true, color: BAD, spacing: 0.6 });
      text(body, M + 16, ty + 24, CW - 30, { size: 9.5, color: INK });
      doc.y = ty + h + 14;
    }

    // Key findings.
    if (n?.keyFindings.length) {
      sub('Key findings');
      n.keyFindings.forEach((f, i) => {
        const h = textH(f.detail, CW - 40, 9) + 22;
        ensure(h + 6);
        const y = doc.y;
        doc.roundedRect(M, y, CW, h, 6).fill(i % 2 ? '#FFFFFF' : PANEL);
        doc.circle(M + 15, y + 15, 9).fill(BRAND);
        text(String(i + 1), M + 6, y + 10.5, 18, { size: 8.5, bold: true, color: '#FFFFFF', align: 'center' });
        text(f.title, M + 32, y + 7, CW - 40, { size: 10, bold: true, color: INK });
        text(f.detail, M + 32, doc.y + 1, CW - 40, { size: 9, color: BODY });
        doc.y = y + h + 6;
      });
    }
  }

  /* ================= 2. scorecard ================= */
  if (ai?.scores.length) {
    section(++num, 'Who is best at what', 'Each area is scored out of 10 for every website. Darker blue means stronger; the gold outline marks the single leader of that area (no outline means a tie). The radar shows the same scores as a shape: a bigger, rounder shape is a stronger website.');
    const domains = input.sites.map((s) => s.domain).filter((d) => ai.overall[d] !== undefined);
    const labelW = 120;
    const colW = (CW - labelW) / domains.length;
    // Header.
    ensure(40);
    let y = doc.y;
    const ownCol = domains.indexOf(own.domain);
    if (ownCol >= 0) doc.roundedRect(M + labelW + ownCol * colW - 2, y - 4, colW, 28 + ai.scores.length * 28 + 34, 6).fill(OWN_TINT);
    domains.forEach((d, i) => {
      const x = M + labelW + i * colW;
      dot(x + 6, y + 6, 3.5, colorOf(d));
      text(d === own.domain ? 'YOU' : shortName(d), x + 13, y + 1, colW - 15, { size: 7.5, bold: d === own.domain, color: d === own.domain ? BRAND : INK, height: 10 });
    });
    y += 24;
    for (const s of ai.scores) {
      text(s.area, M, y + 7, labelW - 8, { size: 9, bold: true, color: INK });
      domains.forEach((d, i) => {
        const v = s.scores[d];
        const x = M + labelW + i * colW + 2;
        const a = v === undefined ? 0 : 0.1 + (v / 10) * 0.75;
        doc.fillOpacity(v === undefined ? 1 : a).roundedRect(x, y, colW - 4, 24, 4).fill(v === undefined ? '#F4F6FA' : BRAND).fillOpacity(1);
        if (s.leader === d) doc.lineWidth(1.6).strokeColor(GOLD).roundedRect(x, y, colW - 4, 24, 4).stroke();
        text(v === undefined ? '-' : String(v), x, y + 7, colW - 4, { size: 10, bold: true, color: a > 0.45 ? '#FFFFFF' : INK, align: 'center' });
      });
      y += 28;
    }
    text('Overall /100', M, y + 8, labelW - 8, { size: 9.5, bold: true, color: INK });
    domains.forEach((d, i) => {
      const x = M + labelW + i * colW + 2;
      doc.roundedRect(x, y, colW - 4, 26, 4).fill(d === own.domain ? BRAND : NAVY);
      text(String(ai.overall[d]), x, y + 7, colW - 4, { size: 12, bold: true, color: '#FFFFFF', align: 'center' });
    });
    doc.y = y + 40;

    // Radar.
    ensure(300);
    const cx = M + CW / 2;
    const cy = doc.y + 140;
    const R = 112;
    const k = ai.scores.length;
    const pt = (i: number, v: number) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / k;
      return [cx + Math.cos(ang) * (R * v) / 10, cy + Math.sin(ang) * (R * v) / 10] as [number, number];
    };
    for (const lvl of [2, 4, 6, 8, 10]) doc.lineWidth(0.6).strokeColor(LINE).polygon(...ai.scores.map((_, i) => pt(i, lvl))).stroke();
    ai.scores.forEach((s, i) => {
      const [x, yy] = pt(i, 10);
      doc.lineWidth(0.6).strokeColor(LINE).moveTo(cx, cy).lineTo(x, yy).stroke();
      const [lx, ly] = pt(i, 11.6);
      text(s.area, lx - 55, ly - 5, 110, { size: 7.5, bold: true, color: MUTED, align: 'center' });
    });
    for (const d of [...domains].reverse()) {
      const poly = ai.scores.map((s, i) => pt(i, s.scores[d] ?? 0));
      const isOwn = d === own.domain;
      doc.fillOpacity(isOwn ? 0.22 : 0.05).polygon(...poly).fill(colorOf(d)).fillOpacity(1);
      doc.lineWidth(isOwn ? 2.2 : 1.1).strokeColor(colorOf(d)).polygon(...poly).stroke();
    }
    doc.y = cy + R + 34;
    let lx = M;
    for (const d of domains) {
      font(d === own.domain, 8);
      const w = doc.widthOfString(safe(d)) + 26;
      if (lx + w > M + CW) {
        lx = M;
        doc.y += 14;
      }
      dot(lx + 4, doc.y + 4, 3.5, colorOf(d));
      text(d === own.domain ? `${d} (you)` : d, lx + 11, doc.y, w + 30, { size: 8, bold: d === own.domain, color: INK });
      doc.y -= 10;
      lx += w + 30;
    }
    doc.y += 26;

    // Area guide.
    sub('What each area means');
    for (const s of ai.scores) {
      const meaning = AREA_MEANING[s.area] ?? '';
      const body = `${hi ? hindiLabel(meaning) ?? meaning : meaning}${s.note ? `  ${L('Here: {x}', { x: s.note })}` : ''}`;
      const h = textH(body, CW - 130, 8.5) + 8;
      ensure(h);
      const y0 = doc.y;
      text(s.area, M, y0, 120, { size: 9, bold: true, color: INK });
      text(body, M + 130, y0, CW - 130, { size: 8.5, color: BODY });
      doc.y = Math.max(doc.y, y0 + h);
    }
  }

  /* ================= 3. head to head ================= */
  if (ai?.headToHead.length) {
    section(++num, 'You vs each competitor', 'One card per competitor. Website pressure describes the observed site comparison, not commercial business threat. "You lead" and "They lead" list differences tied to pages that were checked.');
    const THREAT: Record<string, [string, string, string]> = { high: ['HIGH THREAT', '#FEE2E2', BAD], medium: ['MEDIUM THREAT', '#FEF3C7', WARN], low: ['LOW THREAT', '#F1F5F9', MUTED] };
    for (const h of ai.headToHead) {
      const note = n?.competitors.find((c) => c.domain === h.competitor);
      const colW = (CW - 40) / 2;
      const you = h.youLead.map((p) => p.point);
      const them = h.theyLead.map((p) => p.point);
      const listsH = Math.max(bulletsH(you.length ? you : ['Nothing clear.'], colW), bulletsH(them.length ? them : ['Nothing clear.'], colW));
      const reasonW = CW - 110 - 130;
      const reasonH = h.threatReason ? textH(h.threatReason, reasonW, 9) : 0;
      const verdictH = h.verdict ? textH(h.verdict, CW - 28, 9.5, false) + 8 : 0;
      const noteText = note ? [note.summary, note.watchOut ? L('Watch out: {x}', { x: note.watchOut }) : '', note.learnFrom ? L('Learn from them: {x}', { x: note.learnFrom }) : ''].filter(Boolean) : [];
      const noteH = noteText.length ? bulletsH(noteText, CW - 28, 8.5) + 22 : 0;
      const total = 46 + reasonH + verdictH + 22 + listsH + noteH + 14;
      ensure(Math.min(total, BOTTOM - TOP));
      const y = doc.y;
      doc.roundedRect(M, y, CW, total, 10).lineWidth(0.8).strokeColor(LINE).stroke();
      doc.roundedRect(M, y, CW, 40 + reasonH, 10).fill(PANEL);
      dot(M + 16, y + 17, 5, colorOf(h.competitor));
      text(h.competitor, M + 28, y + 11, CW - 200, { size: 13, bold: true, color: INK, height: 16 });
      const [tl, tbg, tfg] = THREAT[h.threat ?? 'medium']!;
      pill(tl, M + 28, y + 28, tbg, tfg, 6.5);
      if (h.threatReason) text(h.threatReason, M + 110, y + 28, reasonW, { size: 9, color: BODY });
      // Score duel.
      const sx = M + CW - 118;
      text(String(ai.overall[own.domain] ?? '-'), sx, y + 9, 50, { size: 18, bold: true, color: colorOf(own.domain), align: 'center' });
      text('YOU', sx, y + 30, 50, { size: 6.5, bold: true, color: FAINT, align: 'center' });
      text('vs', sx + 46, y + 14, 20, { size: 8, color: FAINT, align: 'center' });
      text(String(ai.overall[h.competitor] ?? '-'), sx + 62, y + 9, 50, { size: 18, bold: true, color: colorOf(h.competitor), align: 'center' });
      text('THEM', sx + 62, y + 30, 50, { size: 6.5, bold: true, color: FAINT, align: 'center' });
      let cy = y + 46 + reasonH;
      if (h.verdict) {
        text(h.verdict, M + 14, cy, CW - 28, { size: 9.5, italic: true, color: INK });
        cy += verdictH;
      }
      text('YOU LEAD', M + 14, cy, colW, { size: 7.5, bold: true, color: GOOD, spacing: 0.8 });
      text('THEY LEAD', M + 26 + colW, cy, colW, { size: 7.5, bold: true, color: BAD, spacing: 0.8 });
      cy += 14;
      bullets(you.length ? you : ['Nothing clear.'], M + 14, cy, colW, GOOD);
      bullets(them.length ? them : ['Nothing clear.'], M + 26 + colW, cy, colW, BAD);
      cy += listsH + 8;
      if (noteText.length) {
        doc.roundedRect(M + 10, cy, CW - 20, noteH - 6, 6).fill('#F5F3FF');
        text('ADVICE', M + 18, cy + 6, CW - 36, { size: 7.5, bold: true, color: '#6D28D9', spacing: 0.8 });
        bullets(noteText, M + 18, cy + 18, CW - 36, '#7C3AED', 8.5);
      }
      doc.y = y + total + 12;
    }
  }

  /* ================= 4. SWOT ================= */
  if (ai?.swot && (ai.swot.strengths.length || ai.swot.weaknesses.length)) {
    section(++num, L('SWOT for {x}', { x: own.domain }), 'Strengths and weaknesses describe your website today compared with these competitors. Opportunities are things you could add to win; threats are what competitors do that could pull your visitors away.');
    const quad: [string, string[], string, string][] = [
      ['STRENGTHS', ai.swot.strengths, '#ECFDF5', GOOD],
      ['WEAKNESSES', ai.swot.weaknesses, '#FEF2F2', BAD],
      ['OPPORTUNITIES', ai.swot.opportunities, '#EFF6FF', BRAND],
      ['THREATS', ai.swot.threats, '#FFFBEB', WARN],
    ];
    const qw = (CW - 12) / 2;
    for (let r = 0; r < 2; r += 1) {
      const pair = quad.slice(r * 2, r * 2 + 2);
      const h = Math.max(...pair.map(([, items]) => bulletsH(items.length ? items : ['-'], qw - 24))) + 36;
      ensure(h + 12);
      const y = doc.y;
      pair.forEach(([title, items, bg, fg], i) => {
        const x = M + i * (qw + 12);
        doc.roundedRect(x, y, qw, h, 10).fill(bg);
        text(title, x + 14, y + 12, qw - 28, { size: 9, bold: true, color: fg, spacing: 1 });
        bullets(items.length ? items : ['-'], x + 14, y + 28, qw - 24, fg);
      });
      doc.y = y + h + 12;
    }

    // Win / lose bars.
    if (ai.scores.length) {
      sub('Where you win and where you fall behind (out of 10)');
      const rows = ai.scores.map((s) => {
        const mine = s.scores[own.domain] ?? 0;
        const best = Math.max(0, ...Object.entries(s.scores).filter(([d]) => d !== own.domain).map(([, v]) => v));
        return { area: s.area, mine, best, diff: mine - best };
      }).sort((a, b) => b.diff - a.diff);
      for (const r of rows) {
        ensure(30);
        const y = doc.y;
        text(r.area, M, y + 3, 120, { size: 9, bold: true, color: INK });
        const bx = M + 130;
        const bw = CW - 130 - 80;
        doc.roundedRect(bx, y + 2, bw, 6, 3).fill('#EEF2F8');
        doc.roundedRect(bx, y + 2, Math.max(6, (bw * r.mine) / 10), 6, 3).fill(BRAND);
        doc.roundedRect(bx, y + 12, bw, 6, 3).fill('#EEF2F8');
        doc.roundedRect(bx, y + 12, Math.max(6, (bw * r.best) / 10), 6, 3).fill(FAINT);
        text(r.diff > 0 ? L('+{n} ahead', { n: r.diff }) : r.diff < 0 ? L('{n} behind', { n: r.diff }) : 'level', M + CW - 70, y + 4, 70, { size: 9, bold: true, color: r.diff > 0 ? GOOD : r.diff < 0 ? BAD : MUTED, align: 'right' });
        doc.y = y + 26;
      }
      text('Blue = your score   Grey = best competitor', M + 130, doc.y, CW - 130, { size: 7.5, color: FAINT });
      doc.y += 16;
    }
    if (ai.opportunities.length) {
      sub('Nobody does this well yet');
      ensure(bulletsH(ai.opportunities, CW) + 6);
      doc.y = bullets(ai.opportunities, M, doc.y, CW, '#7C3AED') + 6;
    }
  }

  /* ================= 5. topics & content ================= */
  if (ai && ((ai.topics?.length ?? 0) || ai.gaps.length || (ai.contentIdeas?.length ?? 0))) {
    section(++num, 'Topics & content', 'Which subjects each website covers. A filled dot means the site talks about it; highlighted rows are subjects competitors cover and you do not - each one is a chance for a new page or post. Below are the gaps with the competitor page that shows them, and ready-to-use content ideas.');
    const topics = [...(ai.topics ?? [])].sort((a, b) => Number(a.sites.includes(own.domain)) - Number(b.sites.includes(own.domain)) || b.sites.length - a.sites.length);
    if (topics.length) {
      const labelW = 200;
      const colW = (CW - labelW) / input.sites.length;
      ensure(40);
      let y = doc.y;
      input.sites.forEach((s, i) => {
        const x = M + labelW + i * colW;
        dot(x + colW / 2, y + 4, 3.5, colorOf(s.domain));
        text(s.role === 'own' ? 'YOU' : shortName(s.domain), x + 2, y + 10, colW - 4, { size: 6.8, bold: s.role === 'own', color: s.role === 'own' ? BRAND : MUTED, align: 'center', height: 9 });
      });
      y += 30;
      for (const t of topics) {
        if (y + 18 > BOTTOM) {
          newPage();
          y = doc.y;
        }
        const missing = !t.sites.includes(own.domain);
        if (missing) doc.rect(M, y - 2, CW, 18).fill('#FFFBEB');
        doc.rect(M + labelW + input.sites.findIndex((x) => x.role === 'own') * colW, y - 2, colW, 18).fill(OWN_TINT);
        text(t.topic, M + 6, y + 2, labelW - 10, { size: 8.5, color: INK, height: 12 });
        if (missing) pill('you don\'t cover', M + 6 + Math.min(labelW - 80, (font(false, 8.5), doc.widthOfString(safe(t.topic))) + 6), y + 1, '#FDE68A', '#92400E', 5.8);
        input.sites.forEach((s, i) => {
          const x = M + labelW + i * colW + colW / 2;
          if (t.sites.includes(s.domain)) dot(x, y + 6, 4.5, colorOf(s.domain));
          else doc.lineWidth(0.7).strokeColor('#CBD5E1').circle(x, y + 6, 4).stroke();
        });
        y += 18;
      }
      doc.y = y + 12;
    }
    if (ai.gaps.length) {
      sub('What competitors have that you do not');
      for (const g of ai.gaps) {
        const h = textH(g.why || ' ', CW - 24, 8.5) + 40;
        ensure(h + 6);
        const y = doc.y;
        doc.roundedRect(M, y, CW, h, 6).fill('#FFFBEB');
        doc.rect(M, y, 3, h).fill(GOLD);
        text(g.topic, M + 12, y + 7, CW - 24, { size: 9.5, bold: true, color: INK });
        if (g.why) text(g.why, M + 12, doc.y + 1, CW - 24, { size: 8.5, color: BODY });
        text(L('Seen on: {x}', { x: `${g.competitors.join(', ')}  -  ${g.url}` }), M + 12, y + h - 14, CW - 24, { size: 7.5, color: BRAND, height: 10 });
        doc.y = y + h + 6;
      }
      doc.y += 6;
    }
    if (ai.contentIdeas?.length) {
      sub('Content ideas for you');
      const iw = (CW - 10) / 2;
      for (let i = 0; i < ai.contentIdeas.length; i += 2) {
        const pair = ai.contentIdeas.slice(i, i + 2);
        const extra = (c: (typeof pair)[number]) =>
          (c.outline?.length ? textH(c.outline.map((o, k) => `${k + 1}. ${o}`).join('\n'), iw - 24, 8) + 4 : 0) + (c.keywords?.length ? textH(L('Search phrases: {x}', { x: c.keywords.join(', ') }), iw - 24, 7.5) + 4 : 0);
        const h = Math.max(...pair.map((c) => textH(c.title, iw - 24, 9.5, true) + textH(c.why, iw - 24, 8.5) + extra(c) + 34));
        ensure(h + 8);
        const y = doc.y;
        pair.forEach((c, j) => {
          const x = M + j * (iw + 10);
          doc.roundedRect(x, y, iw, h, 8).fill('#F5F3FF');
          pill(c.format.toUpperCase(), x + 12, y + 9, '#7C3AED', '#FFFFFF', 6.5);
          text(c.title, x + 12, y + 26, iw - 24, { size: 9.5, bold: true, color: INK });
          text(c.why, x + 12, doc.y + 2, iw - 24, { size: 8.5, color: BODY });
          if (c.outline?.length) text(c.outline.map((o, k) => `${k + 1}. ${o}`).join('\n'), x + 12, doc.y + 4, iw - 24, { size: 8, color: INK });
          if (c.keywords?.length) text(L('Search phrases: {x}', { x: c.keywords.join(', ') }), x + 12, doc.y + 4, iw - 24, { size: 7.5, color: '#6B7A94' });
          if (c.inspiredBy) text(L('Inspired by {x}', { x: c.inspiredBy }), x + 12, y + h - 14, iw - 24, { size: 7.5, color: '#6D28D9', height: 10 });
        });
        doc.y = y + h + 8;
      }
    }
  }

  /* ================= 5b. what they sell & social media ================= */
  const offerSites = input.offers?.status === 'completed' ? input.offers.sites : null;
  const anyOffers = Boolean(offerSites?.some(hasOffers));
  const anySocial = input.evidence.some((e) => e.socials?.profiles.length);
  const anyRating = input.evidence.some((e) => e.statedRating);
  if (anyOffers || anySocial || anyRating) {
    section(++num, 'What they sell & social media', 'Prices, packages and event facts each website states on its own pages, shown exactly as written with the page they came from. Then the social profiles each website links to. "-" means the pages read do not say it; nothing is estimated.');
    const labelW = 130;
    const colW = (CW - labelW) / input.sites.length;
    const pathOf = (url: string) => {
      try {
        return new URL(url).pathname || '/';
      } catch {
        return url;
      }
    };
    const header = () => {
      ensure(40);
      const y = doc.y;
      input.sites.forEach((s, i) => {
        const x = M + labelW + i * colW;
        if (s.role === 'own') doc.rect(x, y - 2, colW, 18).fill(OWN_TINT);
        dot(x + 7, y + 6, 3, colorOf(s.domain));
        text(s.domain, x + 13, y + 1, colW - 17, { size: 7.5, bold: true, color: INK, height: 10 });
      });
      doc.y = y + 20;
    };
    /** One row: a label, then per site a bold value and an optional small note (the page it came from). */
    const row = (rowLabel: string, cells: (string | null)[], notes: (string | null)[] = []) => {
      const hs = cells.map((c, i) => (c ? textH(c, colW - 10, 8.5, true) : 11) + (notes[i] ? textH(notes[i]!, colW - 10, 7) + 1 : 0));
      const h = Math.max(textH(rowLabel, labelW - 8, 8.5), ...hs) + 9;
      ensure(h);
      const y = doc.y;
      doc.moveTo(M, y).lineTo(M + CW, y).lineWidth(0.5).strokeColor(LINE).stroke();
      text(rowLabel, M, y + 4.5, labelW - 8, { size: 8.5, color: INK });
      cells.forEach((c, i) => {
        const x = M + labelW + i * colW;
        if (input.sites[i]!.role === 'own') doc.rect(x, y + 0.5, colW, h - 0.5).fill(OWN_TINT);
        const after = text(c ?? '-', x + 5, y + 4.5, colW - 10, { size: 8.5, bold: Boolean(c), color: c ? INK : FAINT });
        if (c && notes[i]) text(notes[i]!, x + 5, after + 1, colW - 10, { size: 7, color: FAINT });
      });
      doc.y = y + h;
    };
    const OFFER_LABELS: Record<OfferField, string> = {
      eventName: 'Event', dates: 'Dates', location: 'City / venue', exhibitors: 'Exhibitors', visitors: 'Visitors',
      stallPrice: 'Stall / booth price', ticketPrice: 'Ticket / entry fee', deadline: 'Booking deadline',
    };
    if (anyOffers && offerSites) {
      const of = (d: string) => offerSites.find((o) => o.domain === d);
      sub('What they sell & at what price', 60);
      header();
      for (const [kind, rowLabel] of [['products', 'Products'], ['services', 'Services']] as const) {
        if (!offerSites.some((o) => o[kind]?.length)) continue;
        row(rowLabel, input.sites.map((s) => { const list = of(s.domain)?.[kind] ?? []; return list.length ? list.slice(0, 8).map((p) => p.value).join('\n') + (list.length > 8 ? `\n+${list.length - 8}` : '') : null; }));
      }
      for (const field of OFFER_FIELDS) {
        if (!offerSites.some((o) => o[field])) continue;
        row(OFFER_LABELS[field], input.sites.map((s) => of(s.domain)?.[field]?.value ?? null), input.sites.map((s) => { const f = of(s.domain)?.[field]; return f ? pathOf(f.url) : null; }));
      }
      for (const [kind, rowLabel] of [['prices', 'Priced offers'], ['claims', 'Numbers they claim']] as const) {
        if (!offerSites.some((o) => o[kind].length)) continue;
        row(rowLabel, input.sites.map((s) => { const list = of(s.domain)?.[kind] ?? []; return list.length ? list.slice(0, 5).map((p) => `${p.label}: ${p.value}`).join('\n') : null; }));
      }
      doc.y += 10;
    }
    if (anyRating) {
      // Kept apart from scores and claims: the site's own statement in its page data, not read from Google.
      sub('Star ratings the websites state (not checked on Google)', 60);
      header();
      const rating = (d: string) => ev(d)?.statedRating ?? null;
      row('Stated rating', input.sites.map((s) => { const r = rating(s.domain); return r ? `${r.value} / ${r.best}` : null; }));
      row('Ratings / reviews', input.sites.map((s) => { const r = rating(s.domain); return r ? [r.ratings != null ? `${r.ratings.toLocaleString('en-IN')} ${L('ratings')}` : null, r.reviews != null ? `${r.reviews.toLocaleString('en-IN')} ${L('reviews')}` : null].filter(Boolean).join('\n') : null; }));
      doc.y += 10;
    }
    if (anySocial) {
      const soc = (d: string) => ev(d)?.socials;
      const reason = (s: { status: string } | null | undefined, linked: boolean) => (!linked ? null : !s ? null : s.status === 'unavailable' ? L('Not set up') : s.status === 'unresolved' ? L('Cannot look up') : s.status === 'not_found' ? L('Not found') : s.status === 'error' ? L('Not available') : null);
      const n = (v: number | null | undefined) => (v == null ? null : v.toLocaleString('en-IN'));
      sub('Social media', 60);
      header();
      const NAMES: Record<string, string> = { youtube: 'YouTube', instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', x: 'X (Twitter)', pinterest: 'Pinterest', threads: 'Threads', tiktok: 'TikTok', whatsapp: 'WhatsApp', telegram: 'Telegram' };
      for (const platform of Object.keys(NAMES)) {
        if (!input.evidence.some((e) => e.socials?.profiles.some((p) => p.platform === platform))) continue;
        row(NAMES[platform]!, input.sites.map((s) => { const p = soc(s.domain)?.profiles.find((x) => x.platform === platform); return p ? p.handle ?? L('Linked') : null; }));
      }
      const yt = (d: string) => soc(d)?.youtube;
      const linked = (d: string, platform: string) => Boolean(soc(d)?.profiles.some((p) => p.platform === platform));
      // YouTube Numbers is temporarily disabled at the user's request; profile links remain.
      const showYoutubeNumbers=false;
      if (showYoutubeNumbers && input.sites.some((s) => linked(s.domain, 'youtube'))) {
        row('YouTube subscribers', input.sites.map((s) => { const v = yt(s.domain); return v?.status === 'ok' ? n(v.subscribers) ?? L('Hidden') : reason(v, linked(s.domain, 'youtube')); }));
        row('YouTube videos', input.sites.map((s) => { const v = yt(s.domain); return v?.status === 'ok' ? n(v.videos) : null; }));
        row('Latest YouTube upload', input.sites.map((s) => { const v = yt(s.domain); return v?.status === 'ok' && v.lastUploadAt ? fmtDate(new Date(v.lastUploadAt)) : null; }));
      }
      // Instagram numbers are not shown for now (owner, 2026-10-23): no Instagram professional account is connected
      // through Meta yet. The run still stores them in `socials.instagram`; the Instagram link row above stays.
    }
  }

  /* ================= 6. speed & tech ================= */
  section(++num, 'Website checks', 'Search basics, content and contact signals measured directly on the sampled website pages.');
  {
    // Checklist.
    type Row = [string, (e: SiteEvidence) => boolean | number | string | null, ('high' | 'low' | ((v: number) => boolean))?];
    const feature = (e: SiteEvidence, key: keyof NonNullable<SiteEvidence['features']>, legacy: boolean) => {
      const state = e.features?.[key]?.state ?? (legacy ? 'present' : 'not_observed');
      return state === 'present' ? 'Present' : state === 'absent_confirmed' ? 'Absent' : state === 'render_failed' ? 'Render failed' : 'Not verified';
    };
    const groups: [string, Row[]][] = [
      ['Search basics', [
        ['Pages in sitemap', (e) => e.tech?.sitemapUrls ?? null, 'high'],
        ['robots.txt', (e) => e.tech?.robotsTxt ?? null],
        ['One H1 on home page', (e) => (e.tech ? e.tech.h1Count === 1 : null)],
        ['Title length (30-60)', (e) => e.tech?.titleLength ?? null, (v) => v >= 30 && v <= 60],
        ['Meta description (70-160)', (e) => e.tech?.descriptionLength ?? null, (v) => v >= 70 && v <= 160],
        ['Canonical tag', (e) => e.tech?.canonical ?? null],
        ['Social share tags', (e) => e.tech?.openGraph ?? null],
        ['Images with alt text (%)', (e) => (e.tech && e.tech.imagesTotal ? Math.round((e.tech.imagesWithAlt / e.tech.imagesTotal) * 100) : null), 'high'],
        ['Structured data types', (e) => e.metrics.schemaTypes.length, 'high'],
        ['Google knows the brand', (e) => (e.brand ? e.brand.status === 'matched' : null)],
      ]],
      ['Content', [
        ['Key pages read', (e) => e.metrics.pages, 'high'],
        ['Words on those pages', (e) => e.metrics.words, 'high'],
        ['Blog / news section', (e) => feature(e, 'blog', e.tech?.hasBlog === true)],
        ['Calls to action', (e) => e.metrics.ctas, 'high'],
      ]],
      ['Reach & trust', [
        ['Phone', (e) => feature(e, 'phone', e.metrics.contact.phone)],
        ['WhatsApp', (e) => feature(e, 'whatsapp', e.metrics.contact.whatsapp)],
        ['Email', (e) => feature(e, 'email', e.metrics.contact.email)],
        ['Contact form', (e) => feature(e, 'contactForm', e.metrics.contact.form)],
        ['Social profiles', (e) => e.metrics.social.length, 'high'],
      ]],
    ];
    sub('Technical & content checklist');
    const labelW = 150;
    const colW = (CW - labelW) / input.sites.length;
    const header = () => {
      const y = doc.y;
      input.sites.forEach((s, i) => {
        const x = M + labelW + i * colW;
        dot(x + colW / 2, y + 4, 3.5, colorOf(s.domain));
        text(s.role === 'own' ? 'YOU' : shortName(s.domain), x + 2, y + 10, colW - 4, { size: 6.8, bold: s.role === 'own', color: s.role === 'own' ? BRAND : MUTED, align: 'center', height: 9 });
      });
      doc.y = y + 30;
    };
    header();
    for (const [group, rows] of groups) {
      ensure(30);
      text(group.toUpperCase(), M, doc.y, CW, { size: 7.5, bold: true, color: MUTED, spacing: 0.8 });
      doc.y += 4;
      for (const [label, get, rule] of rows) {
        if (doc.y + 17 > BOTTOM) {
          newPage();
          header();
        }
        const y = doc.y;
        const values = input.sites.map((s) => {
          const e = ev(s.domain);
          return e?.reachable ? get(e) : null;
        });
        const nums = values.filter((v): v is number => typeof v === 'number');
        const best = rule === 'high' && nums.length > 1 ? Math.max(...nums) : null;
        doc.rect(M + labelW + input.sites.findIndex((x) => x.role === 'own') * colW, y - 1, colW, 17).fill(OWN_TINT);
        doc.moveTo(M, y - 1).lineTo(M + CW, y - 1).lineWidth(0.4).strokeColor(LINE).stroke();
        text(label, M, y + 3, labelW - 8, { size: 8.5, color: INK, height: 11 });
        values.forEach((v, i) => {
          const cx = M + labelW + i * colW + colW / 2;
          if (typeof v === 'boolean') {
            pill(v ? 'YES' : 'NO', cx - 13, y + 2, v ? '#DCFCE7' : '#FEE2E2', v ? GOOD : BAD, 6.5);
          } else if (v == null) {
            text('-', cx - 20, y + 3, 40, { size: 8.5, color: FAINT, align: 'center' });
          } else if (typeof v === 'string' && ['Present', 'Absent', 'Render failed', 'Not verified'].includes(v)) {
            const good = v === 'Present';
            const bad = v === 'Absent';
            text(v, cx - colW / 2, y + 3, colW, { size: 7.5, bold: true, color: good ? GOOD : bad ? BAD : WARN, align: 'center' });
          } else {
            const good = typeof v === 'number' && ((best != null && v === best) || (typeof rule === 'function' && rule(v)));
            const bad = typeof v === 'number' && typeof rule === 'function' && !rule(v);
            text(typeof v === 'number' ? v.toLocaleString('en-IN') : v, cx - colW / 2, y + 3, colW, { size: 8.5, bold: good || bad, color: good ? GOOD : bad ? BAD : INK, align: 'center' });
          }
        });
        doc.y = y + 17;
      }
      doc.y += 6;
    }
  }

  /* ================= 7. plan ================= */
  if (ai?.actions.length || n?.roadmap.length) {
    section(++num, 'Your 90-day plan', 'The roadmap groups the work into three phases. Below it, every recommended action shows its impact (how much it should help), its effort (how much work it is) and the competitor to learn from. Start with the quick wins: high impact, low effort.');
    if (n?.roadmap.length) {
      const pw = (CW - 2 * 10) / 3;
      const h = Math.max(...n.roadmap.map((p) => bulletsH(p.steps, pw - 22, 8.5) + textH(p.focus, pw - 22, 10, true))) + 50;
      ensure(h + 10);
      const y = doc.y;
      const colors = [BAD, WARN, BRAND];
      n.roadmap.forEach((p, i) => {
        const x = M + i * (pw + 10);
        doc.roundedRect(x, y, pw, h, 10).fill(PANEL);
        doc.roundedRect(x, y, pw, 26, 10).fill(colors[i]!);
        doc.rect(x, y + 16, pw, 10).fill(colors[i]!);
        text(p.phase.toUpperCase(), x + 12, y + 8, pw - 24, { size: 8.5, bold: true, color: '#FFFFFF', spacing: 1 });
        text(p.focus, x + 12, y + 34, pw - 22, { size: 10, bold: true, color: INK });
        bullets(p.steps, x + 12, doc.y + 4, pw - 22, colors[i]!, 8.5);
      });
      doc.y = y + h + 16;
    }
    if (ai?.actions.length) {
      const order = ['this week', 'this month', 'this quarter'] as const;
      for (const when of order) {
        const items = ai.actions.filter((a) => (a.when ?? (a.priority === 'high' ? 'this week' : a.priority === 'medium' ? 'this month' : 'this quarter')) === when);
        if (!items.length) continue;
        ensure(textH(items[0]!.action, CW - 150, 9.5, true) + 90);
        sub(when === 'this week' ? 'This week' : when === 'this month' ? 'This month' : 'This quarter');
        for (const a of items) {
          const h = textH(a.action, CW - 150, 9.5, true) + (a.reason ? textH(a.reason, CW - 150, 8.5) : 0) + 18;
          ensure(Math.max(h, a.learnFrom ? 60 : 38) + 6);
          const y = doc.y;
          const quick = a.effort === 'low' && (a.impact ?? a.priority) === 'high';
          doc.roundedRect(M, y, CW, h, 6).fill(quick ? '#ECFDF5' : PANEL);
          text(a.action, M + 12, y + 8, CW - 150, { size: 9.5, bold: true, color: INK });
          if (a.reason) text(a.reason, M + 12, doc.y + 1, CW - 150, { size: 8.5, color: BODY });
          let px = M + CW - 128;
          const impact = a.impact ?? a.priority;
          px += pill(`${impact.toUpperCase()} IMPACT`, px, y + 8, impact === 'high' ? '#FEE2E2' : impact === 'medium' ? '#FEF3C7' : '#F1F5F9', impact === 'high' ? BAD : impact === 'medium' ? WARN : MUTED, 6) + 4;
          pill(`${a.effort.toUpperCase()} EFFORT`, M + CW - 128, y + 24, '#E2E8F0', BODY, 6);
          if (quick) pill('QUICK WIN', M + CW - 128 + 66, y + 24, GOOD, '#FFFFFF', 6);
          if (a.learnFrom) text(L('Learn from {x}', { x: a.learnFrom }), M + CW - 128, y + 40, 124, { size: 7, color: '#6D28D9', height: 18 });
          doc.y = y + Math.max(h, a.learnFrom ? 60 : 38) + 6;
        }
      }
    }
  }

  /* ================= 8. profiles ================= */
  if (ai?.sites.length) {
    section(++num, 'Each website up close', 'For every website: the main promise its home page makes, its tone, what it offers, who it speaks to, and its strengths and weak spots as seen on its own pages.');
    for (const p of ai.sites) {
      const colW = (CW - 36) / 2;
      const st = p.strengths.map((x) => x.point);
      const wk = p.weaknesses.map((x) => x.point);
      const listsH = Math.max(bulletsH(st.length ? st : ['-'], colW, 8.5), bulletsH(wk.length ? wk : ['-'], colW, 8.5));
      const promiseH = p.promise ? textH(`"${p.promise}"`, CW - 28, 11, true) + 6 : 0;
      const summaryH = textH(p.summary, CW - 28, 9) + 6;
      const metaText = [p.tone ? L('Tone: {x}', { x: p.tone }) : '', p.offerings.length ? L('Offers: {x}', { x: p.offerings.join(', ') }) : '', p.audience ? L('Speaks to: {x}', { x: p.audience }) : ''].filter(Boolean).join('   |   ');
      const metaH = metaText ? textH(metaText, CW - 28, 8) + 6 : 0;
      const total = 36 + promiseH + summaryH + metaH + 16 + listsH + 12;
      ensure(Math.min(total, BOTTOM - TOP));
      const y = doc.y;
      doc.roundedRect(M, y, CW, total, 10).lineWidth(0.8).strokeColor(LINE).stroke();
      doc.roundedRect(M, y, CW, 28, 10).fill(PANEL);
      doc.rect(M, y + 18, CW, 10).fill(PANEL);
      dot(M + 16, y + 14, 5, colorOf(p.domain));
      text(p.domain === own.domain ? L('{d}  (you)', { d: p.domain }) : p.domain, M + 28, y + 8, CW - 120, { size: 12, bold: true, color: INK, height: 15 });
      if (ai.overall[p.domain] != null) text(`${ai.overall[p.domain]}/100`, M + CW - 90, y + 8, 78, { size: 12, bold: true, color: colorOf(p.domain), align: 'right' });
      let cy = y + 36;
      if (p.promise) {
        text(`"${p.promise}"`, M + 14, cy, CW - 28, { size: 11, bold: true, italic: true, color: INK });
        cy += promiseH;
      }
      text(p.summary, M + 14, cy, CW - 28, { size: 9, color: BODY });
      cy += summaryH;
      if (metaText) {
        text(metaText, M + 14, cy, CW - 28, { size: 8, color: MUTED });
        cy += metaH;
      }
      text('STRENGTHS', M + 14, cy, colW, { size: 7.5, bold: true, color: GOOD, spacing: 0.8 });
      text('WEAK SPOTS', M + 22 + colW, cy, colW, { size: 7.5, bold: true, color: BAD, spacing: 0.8 });
      bullets(st.length ? st : ['-'], M + 14, cy + 13, colW, GOOD, 8.5);
      bullets(wk.length ? wk : ['-'], M + 22 + colW, cy + 13, colW, BAD, 8.5);
      doc.y = y + total + 12;
    }
  }

  /* ================= 9. KPIs, closing, method ================= */
  section(++num, 'How to track progress', 'The numbers to watch at every re-check, the final advice, what changed since the previous check, and how this report was made.');
  {
    if (n?.kpis.length) {
      sub('KPIs to track');
      const c1 = 150;
      const c3 = 150;
      const c2 = CW - c1 - c3 - 20;
      for (const k of n.kpis) {
        const h = Math.max(textH(k.metric, c1, 9, true), textH(k.why, c2, 8.5), textH(k.target, c3, 8.5, true)) + 12;
        ensure(h + 4);
        const y = doc.y;
        doc.roundedRect(M, y, CW, h, 5).fill(PANEL);
        text(k.metric.charAt(0).toUpperCase() + k.metric.slice(1), M + 8, y + 6, c1 - 8, { size: 9, bold: true, color: INK });
        text(k.why, M + c1 + 10, y + 6, c2, { size: 8.5, color: BODY });
        text(k.target, M + c1 + c2 + 20, y + 6, c3 - 8, { size: 8.5, bold: true, color: BRAND });
        doc.y = y + h + 4;
      }
      doc.y += 10;
    }
    if (n?.closing) {
      const h = textH(n.closing, CW - 36, 10.5, false, 2.5) + 34;
      ensure(h + 10);
      const y = doc.y;
      const g = doc.linearGradient(M, y, M + CW, y + h);
      g.stop(0, NAVY).stop(1, VIOLET);
      doc.roundedRect(M, y, CW, h, 10).fill(g);
      text('FINAL WORD', M + 18, y + 12, CW - 36, { size: 8, bold: true, color: '#C7D2FE', spacing: 1.5 });
      text(n.closing, M + 18, y + 26, CW - 36, { size: 10.5, color: '#FFFFFF', lineGap: 2.5 });
      doc.y = y + h + 16;
    }
    if (input.changes?.length) {
      sub('What changed since the previous check');
      for (const c of input.changes) {
        ensure(16);
        const y = doc.y;
        dot(M + 4, y + 5, 3, c.direction === 'up' ? GOOD : c.direction === 'down' ? BAD : FAINT);
        text(`${c.domain}: ${c.text}`, M + 14, y, CW - 14, { size: 8.5, color: BODY });
        doc.y += 3;
      }
      doc.y += 8;
    }
    sub('How this report was made');
    const method = [
      `On ${fmtDate(input.checkedAt)} the home page and up to nine prioritised About, Contact, Services, Projects, Blog, Clients and similar pages of each website were checked. JavaScript rendering was used only when static HTML appeared incomplete.`,
      'Counts, feature states, social links, structured data, sitemaps and technical tags were measured from saved page evidence. Missing evidence is shown as not verified, never as absent.',
      'Scores are calculated deterministically from measured evidence. AI text is filtered against observed URLs and conflicting recommendations are removed.',
      `Quality status: ${quality.status.replace('_', ' ')} (${quality.score}%). Website quality is not a business-threat score. ${input.businessThreat?.message ?? 'Business threat requires separate market and commercial evidence.'}`,
    ];
    ensure(bulletsH(method, CW, 8.5));
    doc.y = bullets(method, M, doc.y, CW, BRAND, 8.5) + 8;
    sub('Pages read');
    for (const e of input.evidence) {
      const lines = e.reachable ? e.pages.map((p) => p.url) : [L('Could not be read: {x}', { x: e.error ?? 'unknown error' })];
      const h = lines.length * 11 + 14;
      ensure(h);
      text(e.domain, M, doc.y, CW, { size: 8.5, bold: true, color: INK });
      for (const l of lines) text(l, M + 10, doc.y, CW - 10, { size: 7.5, color: e.reachable ? BRAND : BAD, height: 10 });
      doc.y += 5;
    }
  }

  if(input.businessIntelligence){
    const business=input.businessIntelligence;
    const businessLine=(value:string,bold=false,color=MUTED)=>{const height=textH(value,CW,8.5,bold)+5;ensure(height);text(value,M,doc.y,CW,{size:8.5,bold,color});doc.y+=4;};
    const businessMetric=(label:string,value:unknown,depth=0)=>{
      if(depth>5)return;
      if(value===null||value===undefined){businessLine(`${label}: ${profileLabel(input.lang??'en','Not observed')}`);return;}
      if(['string','number','boolean'].includes(typeof value)){businessLine(`${label}: ${String(value)}`);return;}
      if(Array.isArray(value)){for(let i=0;i<Math.min(value.length,15);i++)businessMetric(`${label} ${i+1}`,value[i],depth+1);return;}
      for(const [key,item]of Object.entries(value as Record<string,unknown>))businessMetric(`${label} / ${key}`,item,depth+1);
    };
    for(const section of business.sections){
      newPage();text(profileLabel(input.lang??'en',section.title),M,doc.y,CW,{size:17,bold:true,color:INK});doc.y+=10;
      if(section.id==='overview'){businessLine(business.summary);businessLine(profileLabel(input.lang??'en','Source quotations remain in their original language.'));}
      if(section.id==='swot'){
        for(const source of business.swot.strengths){businessLine(`${source.kind}: ${source.quote}`);businessLine(source.url,false,BRAND);}
        for(const key of ['weaknesses','opportunities','threats'] as const){businessLine(profileLabel(input.lang??'en',key),true,INK);for(const value of business.swot[key])businessLine(value);}
      }else if(section.id==='roadmap'){
        if(!business.roadmap.length)businessLine(profileLabel(input.lang??'en','No evidence-supported priority action in this sample.'));
        for(const action of business.roadmap){businessLine(`${profileLabel(input.lang??'en',action.priority)} — ${action.action}`,true,INK);businessLine(action.reason);for(const source of action.evidence)businessLine(`${source.url} | ${source.quote}`,false,BRAND);}
      }else if(section.id==='history'){
        if(!business.changes.length)businessLine(profileLabel(input.lang??'en','The first advanced run establishes the evidence baseline.'));
        for(const change of business.changes)businessLine(`${change.domain} | ${profileLabel(input.lang??'en',change.section)}: ${change.message}`);
      }else for(const site of section.sites){
        ensure(65);businessLine(`${site.domain} — ${profileLabel(input.lang??'en',site.status)}`,true,INK);
        for(const source of site.findings){
          businessLine(`${profileLabel(input.lang??'en',source.kind)} · ${profileLabel(input.lang??'en',source.confidence)} | ${source.quote}`);
          businessLine(`${source.url} | ${source.observedAt}`,false,BRAND);
        }
        const metrics=site.metrics as Record<string,any>;
        if(Array.isArray(metrics.segments)&&metrics.segments.length)businessLine(`${profileLabel(input.lang??'en','Industry segments')}: ${metrics.segments.join(', ')}`);
        for(const event of (metrics.events??[]) as Record<string,unknown>[])businessLine([event.name,event.startDate,event.endDate,event.venue,event.organizer,event.url].filter(Boolean).join(' | '));
        for(const claim of [...(metrics.publishedClaims??[]),...(metrics.publishedStatistics??[])] as Record<string,unknown>[])businessLine(`${profileLabel(input.lang??'en','Website-stated claim')}: ${claim.field??claim.label}: ${claim.value} | ${claim.url}`);
        if(metrics.technical)for(const [key,value]of Object.entries(metrics.technical))businessLine(`${key}: ${Array.isArray(value)?value.join(', '):value??profileLabel(input.lang??'en','Not observed')}`);
        for(const journey of (metrics.journeys??[]) as {label:string;pages:{url:string;forms:number;fields:number;requiredFields:number;labelledFields:number}[]}[])for(const page of journey.pages)businessLine(`${profileLabel(input.lang??'en',journey.label)}: ${page.forms} forms, ${page.fields} fields, ${page.requiredFields} required, ${page.labelledFields} labelled | ${page.url}`);
        for(const key of ['comparisonSignals','positioning','socials','content','segmentEvidence','certificationMentions'])if(metrics[key])businessMetric(key,metrics[key]);
        for(const warning of site.warnings)businessLine(warning,false,'#92400E');
        doc.y+=8;
      }
    }
  }

  if (input.profileResults && input.profileResults.version !== 'general-v1') {
    newPage();
    const heading = hi ? 'प्रदर्शनी और व्यापार आयोजन: प्रमाण' : 'Exhibition and trade event evidence';
    text(heading, M, doc.y, CW, { size: 17, bold: true, color: INK });
    doc.y += 10;
    text(hi ? 'ये स्कोर देखे गए पेज संकेतों पर आधारित हैं। पंजीकरण की सफलता या रूपांतरण दर को मापा नहीं गया है।' : 'These scores describe observed page signals. Completed registrations and conversion rates were not measured.', M, doc.y, CW, { size: 9, color: MUTED });
    doc.y += 10;
    for (const site of input.profileResults.sites) {
      ensure(65);
      text(`${site.domain} — ${site.observedCapabilityScore ?? '-'} / 100 (${input.profileResults.version})`, M, doc.y, CW, { size: 11, bold: true, color: INK });
      for (const rule of site.rules) {
        const state = rule.state === 'present' ? (hi ? 'देखा गया' : 'Observed') : (hi ? 'नहीं देखा गया' : 'Not observed');
        ensure(45);
        text(`${profileLabel(input.lang ?? 'en', rule.label)}: ${state} (${profileLabel(input.lang ?? 'en', rule.confidence)})`, M, doc.y + 4, CW, { size: 9, bold: true });
        for (const source of rule.evidence) {
          const h = textH(source.snippet, CW - 12, 8) + textH(source.url, CW - 12, 7.5) + 10;
          ensure(h);
          text(source.snippet, M + 12, doc.y + 3, CW - 12, { size: 8, color: MUTED });
          text(source.url, M + 12, doc.y + 2, CW - 12, { size: 7.5, color: BRAND });
        }
      }
      for(const journey of site.journeys??[]){
        ensure(45);
        text(profileLabel(input.lang??'en',journey.label), M, doc.y+5, CW, {size:9,bold:true});
        for(const page of journey.pages){
          ensure(70);
          text(page.url,M+12,doc.y+3,CW-12,{size:7.5,color:BRAND});
          const counts=hi?`फॉर्म: ${page.forms}, फ़ील्ड: ${page.fields}, आवश्यक: ${page.requiredFields}, लेबल: ${page.labelledFields}`:`Forms: ${page.forms}, fields: ${page.fields}, required: ${page.requiredFields}, labelled: ${page.labelledFields}`;
          text(counts,M+12,doc.y+3,CW-12,{size:8,color:MUTED});
          text(hi?'फॉर्म जमा नहीं किया गया; आगे के चरणों की जाँच नहीं हुई।':'The form was not submitted; subsequent steps were not tested.',M+12,doc.y+2,CW-12,{size:8,color:MUTED});
        }
      }
      doc.y += 12;
    }
  }

  /* ---------------- header and footer on every page but the cover ---------------- */
  const range = doc.bufferedPageRange();
  for (let i = 1; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    doc.rect(0, 0, W, 4).fill(BRAND);
    text('COMPETITOR INTELLIGENCE REPORT', M, 26, CW / 2, { size: 7, bold: true, color: FAINT, spacing: 1.2 });
    text(own.domain, W / 2, 26, CW / 2, { size: 7.5, bold: true, color: MUTED, align: 'right' });
    doc.moveTo(M, 42).lineTo(W - M, 42).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.moveTo(M, H - 40).lineTo(W - M, H - 40).lineWidth(0.5).strokeColor(LINE).stroke();
    text(input.brandName ? L('Prepared for {x} with {brand}',{x:input.preparedFor,brand:input.brandName}) : L('Prepared for {x} with Media360', { x: input.preparedFor }), M, H - 32, CW - 80, { size: 7, color: FAINT, height: 9 });
    text(L('Page {a} of {b}', { a: i + 1, b: range.count }), W - M - 80, H - 32, 80, { size: 7, bold: true, color: MUTED, align: 'right' });
  }

  doc.end();
  return done;
}
