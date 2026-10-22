import fs from "fs";
import path from "path";
import { renderScoreRing } from "./scoreRing";
import { coverCrop, imageSize } from "./emailImages";

/*
 * Emails sent when a careers application is submitted:
 *   - renderCandidateSubmittedEmail → the candidate ("Application Submitted Successfully")
 *   - renderHrNewApplicationEmail   → the HR team ("New Application Received")
 * Table layout with inline styles so Gmail, Outlook and phone apps show the same thing.
 * Every picture is embedded in the email (cid:), so it shows even when remote images are blocked.
 */

/* ---------------- data ---------------- */

export interface SubmissionEmailData {
  applicationId: string;
  submittedAt: Date;
  candidate: {
    name: string;
    email: string;
    phone: string;
    location: string;
    gender: string;
    linkedin: string;
    /** https URL or data: URL; empty when no photo */
    photo: string;
  };
  job: { title: string; location: string };
  preferredLocations: string[];
  analysis: {
    score: number;
    summary: string;
    breakdown: { education: number; experience: number; skills: number; industry: number; location: number; roleFit: number };
    highlights: string[];
  };
  /** url: a link HR can open (empty when there is none); file: attached to the HR email */
  cv: { fileName: string; size: string; url: string; file?: Buffer | null };
  support: { email: string; phone: string };
  siteUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  attachments: { filename: string; content: Buffer; cid: string; contentType: string }[];
}

/* ---------------- assets ---------------- */

const ASSET_DIRS = [
  path.resolve(process.cwd(), "assets/email"),
  path.resolve(__dirname, "../../../assets/email"),
  path.resolve(__dirname, "../../../../assets/email"),
];
const assetDir = () => ASSET_DIRS.find((d) => fs.existsSync(d)) || ASSET_DIRS[0];
const cache = new Map<string, Buffer | null>();
const readAsset = (file: string) => {
  if (!cache.has(file)) {
    const p = path.join(assetDir(), file);
    cache.set(file, fs.existsSync(p) ? fs.readFileSync(p) : null);
  }
  return cache.get(file) ?? null;
};

/** Collects the embedded images an email uses */
class Images {
  list: RenderedEmail["attachments"] = [];
  private seen = new Set<string>();
  /** <img> for an asset in assets/email (shown at width × height px) */
  tag(file: string, width: number, height: number | "auto", alt = "", style = "") {
    const cid = this.add(file);
    if (!cid) return "";
    // Outlook needs both sizes; "auto" is worked out from the file
    let h = height;
    if (h === "auto") {
      const size = imageSize(readAsset(file) as Buffer);
      h = size ? Math.round((width * size.height) / size.width) : width;
    }
    // Large pictures may shrink on phones (height:auto); small icons keep their size
    const fluid = width > 160;
    return `<img src="cid:${cid}" width="${width}" height="${h}" alt="${esc(alt)}" style="display:block;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;width:${width}px;${fluid ? "max-width:100%;height:auto;" : `min-width:${width}px;height:${h}px;`}${style}" />`;
  }
  add(file: string): string | null {
    const cid = `${file.replace(/[^a-z0-9]/gi, "-")}@boe-careers`;
    if (this.seen.has(cid)) return cid;
    const content = readAsset(file);
    if (!content) return null;
    this.seen.add(cid);
    this.list.push({ filename: file.split("/").pop() || file, content, cid, contentType: file.endsWith(".jpg") ? "image/jpeg" : "image/png" });
    return cid;
  }
  /** The score ring, drawn for this score */
  ring(score: number, size: number) {
    const cid = "match-score@boe-careers";
    if (!this.seen.has(cid)) {
      this.seen.add(cid);
      this.list.push({ filename: "match-score.png", content: renderScoreRing(score), cid, contentType: "image/png" });
    }
    return `<img src="cid:${cid}" width="${size}" height="${size}" alt="${Math.round(score)}% Match Score" style="display:block;border:0;outline:none;width:${size}px;min-width:${size}px;height:${size}px;" />`;
  }
  /** A candidate photo given as a data: URL is attached; an https URL is linked */
  photo(src: string, width: number, height: number): string | null {
    if (/^https?:\/\//i.test(src)) return src;
    const m = src.match(/^data:(image\/(png|jpe?g|webp));base64,(.+)$/i);
    if (!m) return null;
    const cid = "candidate-photo@boe-careers";
    if (!this.seen.has(cid)) {
      this.seen.add(cid);
      const original = Buffer.from(m[3], "base64");
      // Cropped to the frame at 2x: Outlook does not support object-fit and would stretch it
      const cropped = coverCrop(original, m[1], width * 2, height * 2);
      this.list.push(
        cropped
          ? { filename: "photo.jpg", content: cropped, cid, contentType: "image/jpeg" }
          : { filename: `photo.${m[2].replace("jpeg", "jpg")}`, content: original, cid, contentType: m[1] }
      );
    }
    return `cid:${cid}`;
  }
}

/* ---------------- helpers ---------------- */

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const C = {
  page: "#f4f2ea",
  sheet: "#fbfaf4",
  card: "#f7faf3",
  border: "#e1e9d9",
  ink: "#12284a",
  green: "#0f5e30",
  greenBright: "#1d8a43",
  text: "#33413a",
  muted: "#5d6b62",
  pill: "#e4f2df",
};
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "Arial,Helvetica,sans-serif";
const W = 720;

const fmtDate = (d: Date) =>
  new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).replace(/\b(am|pm)\b/, (m) => m.toUpperCase());

const level = (score: number) => (score >= 70 ? "high" : score >= 50 ? "moderate" : "low");
const barColor = (s: number) => (s >= 70 ? "#1d7a3e" : s >= 50 ? "#e8860f" : "#d3242b");

const card = (inner: string, pad = "14px 16px") =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:${C.card};border:1px solid ${C.border};border-radius:12px;"><tr><td style="padding:${pad};">${inner}</td></tr></table>`;

const spacer = (h: number) => `<tr><td style="height:${h}px;line-height:${h}px;font-size:0;">&nbsp;</td></tr>`;

/** Section heading: icon + serif title (+ optional sub-line) */
const heading = (img: Images, icon: string, size: number, title: string, sub = "", titleSize = 21, extra = "") => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="${size + 10}" valign="middle" style="padding-right:10px;">${img.tag(icon, size, size, "")}</td>
    <td valign="middle" style="font-family:${SERIF};font-size:${titleSize}px;font-weight:bold;color:${C.ink};line-height:1.15;">${esc(title)}${extra}${
      sub ? `<div style="font-family:${SANS};font-size:11.5px;font-weight:normal;color:${C.muted};padding-top:3px;">${esc(sub)}</div>` : ""
    }</td>
  </tr></table>`;

function breakdownGrid(img: Images, b: SubmissionEmailData["analysis"]["breakdown"]) {
  const cell = (icon: string, label: string, v: number) => {
    const s = Math.max(0, Math.min(100, Math.round(v)));
    return `<td width="50%" valign="top" style="padding:6px 8px 6px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="30" valign="middle">${img.tag(icon, 22, 22, "")}</td>
        <td valign="middle" style="padding-left:6px;">
          <div style="font-family:${SANS};font-size:11.5px;color:${C.ink};padding-bottom:4px;">${esc(label)}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td valign="middle"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#dfe5dc;border-radius:6px;"><tr>
              ${s > 0 ? `<td width="${s}%" style="background:${barColor(s)};border-radius:6px;height:8px;line-height:8px;font-size:0;">&nbsp;</td>` : ""}
              ${s < 100 ? `<td style="height:8px;line-height:8px;font-size:0;">&nbsp;</td>` : ""}
            </tr></table></td>
            <td width="44" align="right" valign="middle" style="font-family:${SANS};font-size:12.5px;font-weight:bold;color:${C.ink};">${s}%</td>
          </tr></table>
        </td>
      </tr></table>
    </td>`;
  };
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>${cell("b-cap.png", "Educational Qualification", b.education)}${cell("b-people.png", "Industry Experience", b.industry)}</tr>
    <tr>${cell("b-brief.png", "Relevant Experience", b.experience)}${cell("i-pin.png", "Location Preference", b.location)}</tr>
    <tr>${cell("b-leaf.png", "Key Skills", b.skills)}${cell("b-target.png", "Role Fit", b.roleFit)}</tr>
  </table>`;
}

/** AI Screening Result + Match Breakdown card (both emails) */
function screeningCard(img: Images, d: SubmissionEmailData, forHr: boolean) {
  const lv = level(d.analysis.score);
  const tag = { high: "Strong Match", moderate: "Moderate Match", low: "Low Match" }[lv];
  const verdict = { high: "Eligible to Apply", moderate: "Partial Match", low: "Under Review" }[lv];
  const verdictColor = { high: C.green, moderate: "#c2620a", low: "#b3262c" }[lv];
  const summary =
    d.analysis.summary ||
    (forHr
      ? "The candidate's profile was evaluated against the job requirements and qualifications derived from the job description."
      : "Your profile was evaluated against the job requirements, based on skills, experience and qualifications derived from your CV.");
  return card(`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td class="col" width="48%" valign="top" style="padding-right:12px;">
        ${heading(img, "i-chart.png", 34, "AI Screening Result", forHr ? "Here is the candidate's profile match and analysis based on the job requirements." : "Here is your profile match and analysis for the applied position.")}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;"><tr>
          <td width="118" valign="middle">${img.ring(d.analysis.score, 112)}</td>
          <td valign="middle" style="padding-left:8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#eef6ea;border-radius:10px;"><tr><td style="padding:10px 12px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                <td valign="top" style="padding-right:8px;">${img.tag("i-check-big.png", 22, 22, "")}</td>
                <td valign="top">
                  ${forHr ? "" : `<div style="font-family:${SERIF};font-size:14px;font-weight:bold;color:${C.ink};">${esc(tag)}</div>`}
                  <div style="font-family:${SANS};font-size:${forHr ? 16 : 17}px;font-weight:bold;color:${verdictColor};padding-top:2px;">${esc(verdict)}</div>
                </td>
              </tr></table>
              <div style="font-family:${SANS};font-size:11.5px;line-height:1.45;color:${C.text};padding-top:5px;">${esc(summary)}</div>
            </td></tr></table>
          </td>
        </tr></table>
      </td>
      <td class="col" width="52%" valign="top" style="padding-left:6px;">
        ${heading(img, "i-crown.png", 32, "Match Breakdown", forHr ? "Here's how the candidate's profile aligns with the key requirements:" : "Here's how your profile aligns with the job requirements:", 17)}
        <div style="height:6px;line-height:6px;font-size:0;">&nbsp;</div>
        ${breakdownGrid(img, d.analysis.breakdown)}
      </td>
    </tr></table>
    ${
      forHr
        ? ""
        : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;border-collapse:separate;background:#eaf3fc;border-radius:8px;"><tr>
            <td width="34" valign="middle" style="padding:8px 0 8px 10px;">${img.tag("i-info.png", 22, 22, "")}</td>
            <td valign="middle" style="padding:8px 12px 8px 6px;font-family:${SANS};font-size:11px;line-height:1.45;color:${C.text};">This is a preliminary AI assessment based on the information provided in your application. Final recruitment decisions are made by our authorised recruitment team after a complete review of your application, documents and further evaluation.</td>
          </tr></table>`
    }`);
}

/** Four step cards with arrows between them */
function steps(img: Images, items: { icon: string; title: string; text: string; pill?: string }[], numbered: boolean, iconsLeft = false) {
  const cells = items
    .map((s, i) => {
      const num = `<td valign="middle" style="padding-right:8px;"><!--[if mso]><v:oval xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:26px;height:26px;v-text-anchor:middle;"><v:fill color="#1d6b3a" /><v:textbox inset="0,0,0,0"><center style="color:#ffffff;font-family:${SANS};font-size:13px;font-weight:bold;">${i + 1}</center></v:textbox></v:oval><![endif]--><!--[if !mso]><!--><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" width="26" height="26" style="width:26px;height:26px;border-radius:13px;background:#1d6b3a;color:#ffffff;font-family:${SANS};font-size:13px;font-weight:bold;">${i + 1}</td></tr></table><!--<![endif]--></td>`;
      const head = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ${iconsLeft ? "" : 'align="center"'}><tr>${numbered ? num : ""}<td valign="middle">${img.tag(s.icon, 28, 28, "")}</td></tr></table>`;
      const box = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:${C.card};border:1px solid ${C.border};border-radius:10px;"><tr><td align="${iconsLeft ? "left" : "center"}" valign="top" class="step" style="padding:10px 8px;height:118px;">
        ${head}
        <div style="font-family:${SERIF};font-size:13.5px;font-weight:bold;color:${C.ink};padding-top:7px;">${esc(s.title)}</div>
        <div style="font-family:${SANS};font-size:11px;line-height:1.4;color:${C.muted};padding-top:3px;">${esc(s.text)}</div>
        ${s.pill ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin-top:7px;"><tr><td style="background:${C.pill};border-radius:6px;padding:3px 10px;font-family:${SANS};font-size:11px;color:${C.ink};">${esc(s.pill)}</td></tr></table>` : ""}
      </td></tr></table>`;
      const arrow = i < items.length - 1 ? `<td class="hide-sm" width="14" align="center" valign="middle" style="font-family:${SANS};font-size:16px;color:#7a9a83;">&rsaquo;</td>` : "";
      return `<td class="col" width="23%" valign="top">${box}</td>${arrow}`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>`;
}

function footer(img: Images, d: SubmissionEmailData) {
  const site = d.siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const row = (icon: string, content: string) =>
    `<tr><td width="22" valign="middle" style="padding:2px 0;">${img.tag(icon, 15, 15, "")}</td><td valign="middle" style="padding:2px 0 2px 4px;font-family:${SANS};font-size:12px;color:#ffffff;">${content}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#0d4a2a;border-radius:18px 18px 0 0;"><tr>
    <td class="col" width="238" valign="middle" style="padding:14px 10px 14px 18px;">${img.tag("f-logo.png", 190, "auto", "Bharat Organic Expo")}</td>
    <td class="col" width="250" valign="middle" style="padding:10px;border-left:1px solid #2f6d47;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        ${row("f-globe.png", `<a href="${esc(d.siteUrl)}" style="color:#ffffff;text-decoration:none;">${esc(site)}</a>`)}
        ${row("f-mail.png", `<a href="mailto:${esc(d.support.email)}" style="color:#ffffff;text-decoration:none;">${esc(d.support.email)}</a>`)}
        ${row("f-pin.png", "Delhi NCR, India")}
      </table>
    </td>
    <td class="col" width="232" align="center" valign="middle" style="padding:10px 16px 10px 6px;">
      ${img.tag("f-social.png", 140, "auto", "LinkedIn · Instagram · Facebook · YouTube", "margin:0 auto;")}
      <div style="font-family:${SERIF};font-style:italic;font-size:13px;line-height:1.3;color:#ffffff;padding-top:6px;">Together for a<br />Healthier Tomorrow</div>
    </td>
  </tr></table>`;
}

const shell = (title: string, body: string) => forOutlook(`<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta http-equiv="X-UA-Compatible" content="IE=edge" /><meta name="color-scheme" content="light" /><meta name="supported-color-schemes" content="light" /><title>${esc(title)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>table,td{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}td,div,p,a,span{mso-line-height-rule:exactly;}img{-ms-interpolation-mode:bicubic;}</style><![endif]-->
<style>
  body{margin:0;padding:0;background:${C.page};}
  a{color:${C.green};}
  @media only screen and (max-width:640px){
    .sheet{width:100% !important;}
    .col{display:block !important;width:100% !important;padding-left:0 !important;padding-right:0 !important;padding-bottom:10px !important;border-left:0 !important;}
    .hide-sm{display:none !important;}
    .step{height:auto !important;}
    .pad{padding-left:12px !important;padding-right:12px !important;}
  }
</style></head>
<body style="margin:0;padding:0;background:${C.page};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};"><tr><td align="center" style="padding:16px 8px;">
<!--[if mso]><table role="presentation" width="${W}" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="sheet" width="${W}" cellpadding="0" cellspacing="0" border="0" style="width:${W}px;max-width:100%;table-layout:fixed;background:${C.sheet};border-radius:14px;overflow:hidden;">
${body}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>`);

/**
 * Outlook (Windows) fixes applied to the finished HTML:
 *  - a bgcolor attribute next to every CSS background colour
 *  - padding on <div> becomes margin (Outlook ignores div padding)
 *  - margin-top on a table becomes a spacer line before it (Outlook ignores table margins)
 */
function forOutlook(html: string): string {
  return html
    .replace(/<(table|td)(\s[^>]*?)style="([^"]*?)background:(#[0-9a-fA-F]{6})([^"]*)"/g, (all, tag, attrs, pre, color, post) =>
      /bgcolor=/.test(attrs) ? all : `<${tag}${attrs}bgcolor="${color}" style="${pre}background:${color}${post}"`
    )
    .replace(/<div style="([^"]*)"/g, (_all, style: string) => `<div style="${style.replace(/padding-(top|bottom):/g, "margin-$1:")}"`)
    .replace(/<table([^>]*?)style="margin-top:(\d+)px;([^"]*)"/g, (_all, attrs, px, rest) =>
      `<div style="height:${px}px;line-height:${px}px;font-size:0;mso-line-height-rule:exactly;">&nbsp;</div><table${attrs}style="${rest}"`
    );
}

const contactRows = (img: Images, d: SubmissionEmailData, small = false) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:${small ? 6 : 10}px;">
    <tr><td width="26" valign="middle" style="padding:3px 8px 3px 0;width:26px;">${img.tag("i-mail-s.png", 16, 13, "")}</td><td valign="middle" style="font-family:${SANS};font-size:${small ? 11.5 : 12.5}px;color:${C.ink};padding:3px 0;"><a href="mailto:${esc(d.support.email)}" style="color:${C.ink};text-decoration:none;">${esc(d.support.email)}</a></td></tr>
    ${d.support.phone ? `<tr><td width="26" valign="middle" style="padding:3px 8px 3px 0;width:26px;">${img.tag("i-phone-s.png", 15, 15, "")}</td><td valign="middle" style="font-family:${SANS};font-size:${small ? 11.5 : 12.5}px;color:${C.ink};padding:3px 0;"><a href="tel:${esc(d.support.phone.replace(/\s/g, ""))}" style="color:${C.ink};text-decoration:none;">${esc(d.support.phone)}</a></td></tr>` : ""}
  </table>`;

/* ---------------- candidate email ---------------- */

export function renderCandidateSubmittedEmail(d: SubmissionEmailData): RenderedEmail {
  const img = new Images();
  const submitted = fmtDate(d.submittedAt);
  const locations = d.preferredLocations.length ? d.preferredLocations.join(", ") : d.job.location;

  const detail = (icon: string, label: string, value: string) => `
    <tr><td style="padding:3px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#ffffff;border-radius:8px;"><tr>
        <td width="34" valign="middle" style="padding:8px 0 8px 10px;">${img.tag(icon, 20, 20, "")}</td>
        <td width="108" valign="middle" style="padding:8px 4px;font-family:${SANS};font-size:11.5px;color:${C.muted};">${esc(label)}</td>
        <td valign="middle" style="padding:8px 10px 8px 0;font-family:${SANS};font-size:12.5px;font-weight:bold;color:${C.ink};">${value}</td>
      </tr></table>
    </td></tr>`;

  const body = `
  <tr><td>${img.tag("c-header.jpg", W, Math.round((W * 140) / 1024), "Bharat Organic Expo — Together for a Healthier Tomorrow")}</td></tr>
  <tr><td class="pad" style="padding:0 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td class="col" width="58%" align="center" valign="middle" style="padding:6px 6px 6px 0;">
        ${img.tag("c-badge.png", 136, 50, "", "margin:0 auto;")}
        <div style="font-family:${SERIF};font-size:31px;line-height:1.12;font-weight:bold;color:${C.ink};padding-top:6px;">Application Submitted<br />Successfully</div>
        <div style="font-family:${SERIF};font-size:14px;color:${C.text};padding-top:8px;">Thank you for your interest in joining Bharat Organic Expo!</div>
        <div style="padding-top:8px;">${img.tag("c-divider.png", 112, 20, "", "margin:0 auto;")}</div>
      </td>
      <td class="col hide-sm" width="42%" valign="top">${img.tag("c-hero.jpg", 290, 142, "Smiling team member giving a thumbs up")}</td>
    </tr></table>
  </td></tr>
  ${spacer(6)}
  <tr><td class="pad" style="padding:0 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td class="col" valign="top" style="font-family:${SANS};color:${C.text};padding-right:12px;">
        <div style="font-size:17px;color:${C.ink};">Dear <b>${esc(d.candidate.name)}</b>,</div>
        <div style="font-size:13.5px;font-weight:bold;color:${C.ink};padding-top:6px;">Namaskar!</div>
        <div style="font-size:13px;line-height:1.55;padding-top:6px;">Thank you for your interest in joining <b style="color:${C.ink};">Bharat Organic Expo</b>. We are pleased to confirm that your application for the position of <b style="color:${C.green};">${esc(d.job.title)}</b> has been successfully submitted. Our team will review your profile and get back to you soon.</div>
      </td>
      <td class="col hide-sm" width="170" valign="middle">${img.tag("c-quote.jpg", 168, 90, "Be a part of a larger movement for organic living and holistic well-being.")}</td>
    </tr></table>
  </td></tr>
  ${spacer(12)}
  <tr><td class="pad" style="padding:0 16px;">${card(`
    ${heading(img, "i-doc-sec.png", 30, "Your Application Details")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;"><tr>
      <td class="col" width="50%" valign="top" style="padding-right:5px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${detail("i-mail.png", "Application ID", esc(d.applicationId))}
        ${detail("i-cap.png", "Position Applied For", esc(d.job.title))}
        ${detail("i-pin.png", "Location Preference", esc(locations))}
      </table></td>
      <td class="col" width="50%" valign="top" style="padding-left:5px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${detail("i-cal.png", "Submitted On", esc(submitted))}
        ${detail("i-people.png", "Application Status", `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${C.pill};border-radius:5px;padding:3px 8px;font-family:${SANS};font-size:12px;font-weight:bold;color:${C.green};white-space:nowrap;">Received – Under Review</td></tr></table>`)}
        ${detail("i-building.png", "Profile Submitted To", "Bharat Organic Expo")}
      </table></td>
    </tr></table>`, "12px 14px 10px")}</td></tr>
  ${spacer(12)}
  <tr><td class="pad" style="padding:0 16px;">${screeningCard(img, d, false)}</td></tr>
  ${spacer(14)}
  <tr><td class="pad" style="padding:0 16px;">
    ${heading(img, "i-gear.png", 28, "What Happens Next?")}
    <div style="height:8px;line-height:8px;font-size:0;">&nbsp;</div>
    ${steps(
      img,
      [
        { icon: "s-doc.png", title: "Application Review", text: "Our HR team will review your application and AI analysis report.", pill: "1 – 3 Working Days" },
        { icon: "s-people.png", title: "Shortlisting", text: "If your profile matches the requirements, you will be shortlisted.", pill: "3 – 5 Working Days" },
        { icon: "s-cal.png", title: "Interview Process", text: "You will be contacted via email/phone for the next steps.", pill: "5 – 10 Working Days" },
        { icon: "s-mail.png", title: "Final Update", text: "You will receive the final status of your application by email.", pill: "Within 2 Weeks" },
      ],
      true
    )}
  </td></tr>
  ${spacer(12)}
  <tr><td class="pad" style="padding:0 16px;">${card(`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td class="col" width="50%" valign="top" style="padding-right:12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="48" valign="top" style="padding-right:10px;">${img.tag("i-headset.png", 38, 38, "")}</td>
          <td valign="top">
            <div style="font-family:${SERIF};font-size:16px;font-weight:bold;color:${C.ink};">Need Help?</div>
            <div style="font-family:${SANS};font-size:11.5px;line-height:1.45;color:${C.muted};padding-top:3px;">If you have any questions regarding your application, please feel free to reach us.</div>
            ${contactRows(img, d)}
          </td>
        </tr></table>
      </td>
      <td class="col" width="50%" valign="middle" style="padding-left:12px;border-left:1px solid ${C.border};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td class="hide-sm" width="76" valign="middle" style="padding-right:10px;">${img.tag("i-hands.jpg", 66, 63, "")}</td>
          <td valign="middle">
            <div style="font-family:${SERIF};font-size:14px;font-weight:bold;color:#d9730d;">Our Mission</div>
            <div style="font-family:${SERIF};font-style:italic;font-size:17px;color:${C.ink};padding-top:2px;">Together for a Healthier Tomorrow</div>
            <div style="font-family:${SERIF};font-style:italic;font-size:11px;line-height:1.45;color:${C.text};padding-top:4px;">At Bharat Organic Expo, we believe in the power of organic living, Ayurveda and sustainable communities. We are excited about the possibility of having you on our team!</div>
          </td>
        </tr></table>
      </td>
    </tr></table>`)}</td></tr>
  ${spacer(14)}
  <tr><td>${footer(img, d)}</td></tr>`;

  const subject = `Application Submitted Successfully – ${d.job.title} (${d.applicationId})`;
  const text = [
    `Dear ${d.candidate.name},`,
    "",
    "Namaskar! Thank you for your interest in joining Bharat Organic Expo.",
    `Your application for the position of ${d.job.title} has been successfully submitted. Our team will review your profile and get back to you soon.`,
    "",
    `Application ID: ${d.applicationId}`,
    `Submitted On: ${submitted}`,
    `Location Preference: ${locations}`,
    `Application Status: Received – Under Review`,
    `AI Match Score: ${d.analysis.score}%`,
    "",
    "What happens next: Application Review (1–3 working days) → Shortlisting (3–5) → Interview Process (5–10) → Final Update (within 2 weeks).",
    "",
    `Need help? ${d.support.email}${d.support.phone ? ` · ${d.support.phone}` : ""}`,
    "",
    "Team Bharat Organic Expo — Together for a Healthier Tomorrow",
  ].join("\n");

  return { subject, html: shell(subject, body), text, attachments: img.list };
}

/* ---------------- HR email ---------------- */

export function renderHrNewApplicationEmail(d: SubmissionEmailData): RenderedEmail {
  const img = new Images();
  const submitted = fmtDate(d.submittedAt);
  const lv = level(d.analysis.score);
  const photo = d.candidate.photo ? img.photo(d.candidate.photo, 104, 116) : null;
  const initials = d.candidate.name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const profileRow = (icon: string, value: string) =>
    value
      ? `<tr><td width="26" valign="middle" style="padding:4px 9px 4px 0;width:26px;min-width:26px;">${img.tag(icon, 17, 17, "")}</td><td valign="middle" style="padding:4px 0;font-family:${SANS};font-size:12.5px;color:${C.ink};">${value}</td></tr>`
      : "";
  const appRow = (icon: string, label: string, value: string, last = false) => `
    <tr>
      <td width="26" valign="middle" style="padding:7px 0;${last ? "" : `border-bottom:1px solid ${C.border};`}">${img.tag(icon, 19, 17, "")}</td>
      <td width="104" valign="middle" style="padding:7px 4px;font-family:${SANS};font-size:11px;color:${C.muted};white-space:nowrap;${last ? "" : `border-bottom:1px solid ${C.border};`}">${esc(label)}</td>
      <td valign="middle" style="padding:7px 0;font-family:${SANS};font-size:12px;font-weight:bold;color:${C.ink};${last ? "" : `border-bottom:1px solid ${C.border};`}">${value}</td>
    </tr>`;

  const genderLine = [d.candidate.gender ? d.candidate.gender.charAt(0).toUpperCase() + d.candidate.gender.slice(1) : ""].filter(Boolean).join("");
  const highlights = d.analysis.highlights.slice(0, 6);
  const reco = {
    high: { title: "Strong Match", text: "The candidate is recommended to move to the next stage of evaluation based on skills, experience and qualifications. Final decision to be taken by HR after detailed review." },
    moderate: { title: "Moderate Match", text: "The candidate meets several key requirements but has gaps in a few areas. A closer review of the CV is recommended before shortlisting. Final decision to be taken by HR." },
    low: { title: "Low Match", text: "The candidate does not meet most of the key requirements for this role. Consider for other openings if relevant. Final decision to be taken by HR." },
  }[lv];

  const body = `
  <tr><td>${img.tag("c-header.jpg", W, Math.round((W * 140) / 1024), "Bharat Organic Expo — Together for a Healthier Tomorrow")}</td></tr>
  <tr><td class="pad" style="padding:2px 22px 0;">
    ${img.tag("h-badge.png", 146, 31, "HR Notification")}
    <div style="font-family:${SERIF};font-size:29px;font-weight:bold;color:${C.ink};padding-top:8px;line-height:1.15;">New Application Received <span style="color:#5aa832;">&#10086;</span></div>
    <div style="font-family:${SANS};font-size:14.5px;color:${C.text};padding-top:3px;">Candidate Details, AI Screening Result &amp; Recommendation</div>
    <div style="font-family:${SANS};font-size:14px;font-weight:bold;color:${C.ink};padding-top:14px;">Dear HR Team,</div>
    <div style="font-family:${SANS};font-size:12.5px;line-height:1.55;color:${C.text};padding-top:5px;">We have received a new application for the position of <b style="color:${C.ink};">${esc(d.job.title)}</b> at <b style="color:${C.ink};">Bharat Organic Expo</b>. Please find below the candidate's profile, AI screening result and analysis. Kindly review the details and take the next steps as per the recruitment process.</div>
  </td></tr>
  ${spacer(12)}
  <tr><td class="pad" style="padding:0 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td class="col" width="47%" valign="top" style="padding-right:6px;">${card(`
        ${heading(img, "h-profile.png", 28, "Candidate Profile", "", 18)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;border-collapse:separate;background:#ffffff;border-radius:10px;"><tr>
          <td width="112" valign="top" style="padding:10px 8px 10px 10px;">${
            photo
              ? `<img src="${esc(photo)}" width="104" height="116" alt="${esc(d.candidate.name)}" style="display:block;width:104px;height:116px;object-fit:cover;border-radius:8px;border:0;-ms-interpolation-mode:bicubic;" />`
              : `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" width="104" height="116" style="width:104px;height:116px;background:#e4efe8;border-radius:8px;font-family:${SANS};font-size:30px;font-weight:bold;color:#1d5a37;">${esc(initials || "CV")}</td></tr></table>`
          }</td>
          <td valign="top" style="padding:10px 10px 10px 4px;">
            <div style="font-family:${SERIF};font-size:18px;font-weight:bold;color:${C.ink};padding-bottom:4px;">${esc(d.candidate.name)}</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              ${profileRow("p-mail.png", d.candidate.email ? `<a href="mailto:${esc(d.candidate.email)}" style="color:${C.ink};text-decoration:none;">${esc(d.candidate.email)}</a>` : "")}
              ${profileRow("p-phone.png", esc(d.candidate.phone))}
              ${profileRow("p-pin.png", esc(d.candidate.location))}
              ${profileRow("p-cal.png", esc(genderLine))}
              ${profileRow("p-in.png", d.candidate.linkedin ? `<a href="${esc(/^https?:/i.test(d.candidate.linkedin) ? d.candidate.linkedin : `https://${d.candidate.linkedin}`)}" style="color:${C.ink};text-decoration:none;">${esc(d.candidate.linkedin)}</a>` : "")}
            </table>
          </td>
        </tr></table>`, "12px")}</td>
      <td class="col" width="53%" valign="top" style="padding-left:6px;">${card(`
        ${heading(img, "h-appdoc.png", 28, "Application Details", "", 18)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;border-collapse:separate;background:#ffffff;border-radius:10px;"><tr><td style="padding:2px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${appRow("h-mail.png", "Application ID", esc(d.applicationId))}
            ${appRow("h-cap.png", "Position Applied For", esc(d.job.title))}
            ${appRow("h-cal.png", "Application Date", esc(submitted))}
            ${appRow("h-cap2.png", "Application Source", "Bharat Organic Expo Careers Portal")}
            ${appRow("h-clock.png", "Application Status", `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${C.pill};border-radius:5px;padding:3px 6px;font-family:${SANS};font-size:11px;font-weight:bold;color:${C.green};white-space:nowrap;">Received – Under HR Review</td></tr></table>`, true)}
          </table>
        </td></tr></table>`, "12px")}</td>
    </tr></table>
  </td></tr>
  ${spacer(12)}
  <tr><td class="pad" style="padding:0 16px;">${screeningCard(img, d, true)}</td></tr>
  ${spacer(12)}
  <tr><td class="pad" style="padding:0 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td class="col" width="51%" valign="top" style="padding-right:6px;">${card(`
        ${heading(img, "h-hl.png", 28, "Key Highlights", "", 17, ` <span style="font-family:${SANS};font-size:12.5px;font-weight:normal;color:${C.text};">(from CV &amp; AI Analysis)</span>`)}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
          ${
            highlights.length
              ? highlights
                  .map((h) => `<tr><td width="24" valign="top" style="padding:4px 0;">${img.tag("h-tick.png", 15, 15, "")}</td><td valign="top" style="padding:4px 0;font-family:${SANS};font-size:12px;line-height:1.4;color:${C.text};">${esc(h)}</td></tr>`)
                  .join("")
              : `<tr><td style="font-family:${SANS};font-size:12px;color:${C.muted};">No specific highlights were identified by the analysis.</td></tr>`
          }
        </table>`, "12px 14px")}</td>
      <td class="col" width="49%" valign="top" style="padding-left:6px;">${card(`
        ${heading(img, "h-res.png", 28, "Resume & Documents", "", 17)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;border-collapse:separate;background:#ffffff;border-radius:10px;"><tr>
          <td width="34" valign="middle" style="padding:8px 0 8px 10px;">${img.tag("h-pdf.png", 24, 27, "PDF")}</td>
          <td valign="middle" style="padding:8px 6px;">
            <div style="font-family:${SANS};font-size:12.5px;font-weight:bold;color:${C.ink};">${esc(d.cv.fileName || "Resume")}</div>
            <div style="font-family:${SANS};font-size:10.5px;color:${C.muted};padding-top:2px;">${esc([d.cv.size, submitted].filter(Boolean).join("  |  "))}</div>
          </td>
          ${
            d.cv.url
              ? `<td align="right" valign="middle" style="padding:8px 10px 8px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#0f5e30" style="background:#0f5e30;border-radius:6px;padding:9px 12px;"><a href="${esc(d.cv.url)}" style="color:#ffffff;font-family:${SANS};font-size:12px;font-weight:bold;text-decoration:none;white-space:nowrap;display:block;">&#8681;&nbsp;Download CV</a></td></tr></table></td>`
              : d.cv.file
                ? `<td align="right" valign="middle" style="padding:8px 10px 8px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#e4f2df;border-radius:6px;padding:9px 12px;color:#0f5e30;font-family:${SANS};font-size:12px;font-weight:bold;white-space:nowrap;">&#128206;&nbsp;CV Attached</td></tr></table></td>`
                : ""
          }
        </tr></table>
        <div style="height:10px;line-height:10px;font-size:0;">&nbsp;</div>
        ${heading(img, "h-star.png", 22, "AI Recommendation", "", 16)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;border-collapse:separate;background:#eef6ea;border-radius:10px;"><tr>
          <td width="56" valign="top" style="padding:10px 0 10px 10px;">${img.tag("h-reco.png", 44, 37, "")}</td>
          <td valign="top" style="padding:10px 12px 10px 6px;">
            <div style="font-family:${SERIF};font-size:15px;font-weight:bold;color:${C.ink};">${esc(reco.title)}</div>
            <div style="font-family:${SANS};font-size:11.5px;line-height:1.45;color:${C.text};padding-top:3px;">${esc(reco.text)}</div>
          </td>
        </tr></table>`, "12px 14px")}</td>
    </tr></table>
  </td></tr>
  ${spacer(12)}
  <tr><td class="pad" style="padding:0 16px;">${card(`
    ${heading(img, "h-gear.png", 26, "Suggested Next Steps for HR", "", 17)}
    <div style="height:8px;line-height:8px;font-size:0;">&nbsp;</div>
    ${steps(
      img,
      [
        { icon: "hs-review.png", title: "Review Application", text: "Go through the candidate's profile, CV and AI analysis in detail." },
        { icon: "hs-people.png", title: "Shortlisting Decision", text: "Mark as shortlisted or not shortlisted in the recruitment system." },
        { icon: "hs-cal.png", title: "Schedule Interview", text: "If shortlisted, coordinate for initial interview (phone / video / in-person)." },
        { icon: "hs-mail.png", title: "Update Candidate", text: "Share the status with the candidate via email through the system." },
      ],
      true,
      true
    )}`, "12px 12px")}</td></tr>
  ${spacer(12)}
  <tr><td class="pad" style="padding:0 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td class="col" width="60%" valign="top" style="padding-right:6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#eaf3fc;border:1px solid #d6e6f6;border-radius:12px;"><tr><td style="padding:12px 14px;">
          ${heading(img, "h-info.png", 22, "Important Note", "", 15)}
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">
            ${[
              "The AI screening score is a preliminary assessment and does not guarantee selection.",
              "Final shortlisting and recruitment decisions are to be made by the HR team.",
              "Please verify the candidate's qualifications, experience and documents as per company policy.",
              "Keep the candidate updated through the recruitment system.",
            ]
              .map((t) => `<tr><td width="24" valign="top" style="padding:3px 0;">${img.tag("h-tick.png", 14, 14, "")}</td><td valign="top" style="padding:3px 0;font-family:${SANS};font-size:11px;line-height:1.4;color:${C.text};">${t}</td></tr>`)
              .join("")}
          </table>
        </td></tr></table>
      </td>
      <td class="col" width="40%" valign="top" style="padding-left:6px;">${card(`
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="46" valign="top" style="padding-right:10px;">${img.tag("h-headset.png", 36, 36, "")}</td>
          <td valign="top">
            <div style="font-family:${SERIF};font-size:15px;font-weight:bold;color:${C.ink};">Need Any Assistance?</div>
            <div style="font-family:${SANS};font-size:11px;line-height:1.45;color:${C.muted};padding-top:3px;">If you need any further information or have queries regarding this application, please feel free to reach out to the recruitment team.</div>
            ${contactRows(img, d, true)}
          </td>
        </tr></table>`, "12px")}</td>
    </tr></table>
  </td></tr>
  ${spacer(14)}
  <tr><td>${footer(img, d)}</td></tr>`;

  const subject = `New Application Received: ${d.candidate.name} – ${d.job.title} (${d.analysis.score}% match)`;
  const text = [
    "Dear HR Team,",
    "",
    `A new application has been received for the position of ${d.job.title}.`,
    "",
    `Candidate: ${d.candidate.name}`,
    `Email: ${d.candidate.email}`,
    `Phone: ${d.candidate.phone}`,
    d.candidate.location ? `Location: ${d.candidate.location}` : "",
    "",
    `Application ID: ${d.applicationId}`,
    `Application Date: ${submitted}`,
    `AI Match Score: ${d.analysis.score}% (${reco.title})`,
    highlights.length ? `Key highlights:\n- ${highlights.join("\n- ")}` : "",
    d.cv.url ? `CV: ${d.cv.url}` : "",
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { subject, html: shell(subject, body), text, attachments: img.list };
}
