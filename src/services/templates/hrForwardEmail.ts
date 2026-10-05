import fs from "fs";
import path from "path";

/**
 * "Forward to HR" email (admin Applications & AI Response). Table layout with inline styles
 * so it renders the same in Gmail, Outlook and phone mail apps. The logo is embedded in the
 * email itself (cid:) instead of linking to a website image, so it shows even when remote
 * images are blocked.
 */

export const LOGO_CID = "boe-logo@bharatorganicexpo";

// backend/assets/email-logo.png (works from src/ with tsx and from dist/ after a build).
const LOGO_PATHS = [
  path.resolve(process.cwd(), "assets/email-logo.png"),
  path.resolve(__dirname, "../../../assets/email-logo.png"),
  path.resolve(__dirname, "../../../../assets/email-logo.png"),
];
let logoCache: Buffer | null | undefined;
export const getEmailLogo = (): Buffer | null => {
  if (logoCache !== undefined) return logoCache;
  const found = LOGO_PATHS.find((p) => fs.existsSync(p));
  logoCache = found ? fs.readFileSync(found) : null;
  return logoCache;
};

export interface HrForwardEmailData {
  applicationId: string;
  forwardedBy: string;
  forwardedAt: Date;
  note: string;
  share: string[];
  candidate: {
    name: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
    totalExperience: string;
    currentCompany: string;
    currentDesignation: string;
    currentCtc: string;
    expectedCtc: string;
    noticePeriod: string;
    willingToRelocate: string;
    skills: string[];
  };
  job: { title: string; department: string; screeningQuestions: string[] };
  analysis: { score: number; result: string; summary: string; strengths: string[]; gaps: string[] };
  whyInterested: string;
  cvFileName: string; // empty when no CV is attached
  cvShared: boolean;
  hasLogo: boolean;
}

const C = {
  green: "#14532D",
  greenMid: "#15803D",
  greenSoft: "#F0F7F2",
  orange: "#EA8A12",
  ink: "#0F172A",
  body: "#334155",
  muted: "#64748B",
  line: "#E2E8F0",
  page: "#EEF2EF",
};
const FONT = "'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

const resultTone = (result: string) =>
  result === "Eligible"
    ? { text: "#166534", bg: "#DCFCE7", bar: "#16A34A" }
    : result === "Partial Match"
    ? { text: "#92400E", bg: "#FEF3C7", bar: "#D97706" }
    : { text: "#991B1B", bg: "#FEE2E2", bar: "#DC2626" };

const formatDateTime = (d: Date) =>
  new Date(d).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

const sectionTitle = (title: string) => `
  <tr><td style="padding:28px 32px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="width:4px;background:${C.orange};border-radius:2px;">&nbsp;</td>
      <td style="padding-left:10px;font-family:${FONT};font-size:15px;font-weight:700;color:${C.green};letter-spacing:.2px;">${esc(title)}</td>
    </tr></table>
  </td></tr>`;

const detailRows = (rows: [string, string][]) =>
  rows
    .filter(([, v]) => v && v.trim())
    .map(
      ([label, value], i) => `
      <tr style="background:${i % 2 ? "#FFFFFF" : "#F8FAF9"};">
        <td style="padding:10px 14px;width:38%;font-family:${FONT};font-size:13px;color:${C.muted};border-bottom:1px solid ${C.line};vertical-align:top;">${esc(label)}</td>
        <td style="padding:10px 14px;font-family:${FONT};font-size:13px;font-weight:600;color:${C.ink};border-bottom:1px solid ${C.line};vertical-align:top;">${value}</td>
      </tr>`
    )
    .join("");

const bulletList = (items: string[], mark: string, color: string) =>
  items
    .map(
      (item) => `
      <tr>
        <td style="width:18px;vertical-align:top;padding:3px 0;font-family:${FONT};font-size:13px;font-weight:700;color:${color};">${mark}</td>
        <td style="padding:3px 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.body};">${esc(item)}</td>
      </tr>`
    )
    .join("");

const factCell = (label: string, value: string) => `
  <td width="25%" style="padding:4px;" valign="top">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.greenSoft};border:1px solid #DCEBE1;border-radius:8px;">
      <tr><td style="padding:10px 12px;">
        <div style="font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:${C.muted};">${esc(label)}</div>
        <div style="font-family:${FONT};font-size:13px;font-weight:700;color:${C.ink};margin-top:3px;">${esc(value || "—")}</div>
      </td></tr>
    </table>
  </td>`;

export const renderHrForwardEmail = (d: HrForwardEmailData) => {
  const { candidate: c, job, analysis: a } = d;
  const tone = resultTone(a.result);
  const score = Math.max(0, Math.min(100, Math.round(a.score)));
  const first = c.name.split(/\s+/)[0] || c.name;
  const subject = `Candidate for review: ${c.name} – ${job.title} (${d.applicationId})`;

  const header = d.hasLogo
    ? `<img src="cid:${LOGO_CID}" width="200" alt="Bharat Organic Expo" style="display:block;width:200px;max-width:200px;height:auto;border:0;margin:0 auto;" />`
    : `<div style="font-family:${FONT};font-size:22px;font-weight:800;color:${C.green};letter-spacing:.5px;">BHARAT ORGANIC <span style="color:${C.orange};">EXPO</span></div>`;

  let body = "";

  // Note from the person who forwarded
  if (d.note) {
    body += `
    <tr><td style="padding:24px 32px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFF8EB;border:1px solid #FCE3B5;border-left:4px solid ${C.orange};border-radius:8px;">
        <tr><td style="padding:14px 16px;">
          <div style="font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#B45309;">Note from ${esc(d.forwardedBy)}</div>
          <div style="font-family:${FONT};font-size:14px;line-height:1.6;color:${C.ink};margin-top:4px;">${esc(d.note).replace(/\n/g, "<br/>")}</div>
        </td></tr>
      </table>
    </td></tr>`;
  }

  if (d.share.includes("Application Form Details")) {
    const link = (href: string, text: string) =>
      `<a href="${esc(href)}" style="color:${C.greenMid};text-decoration:none;">${esc(text)}</a>`;
    body += sectionTitle("Candidate Details");
    body += `
    <tr><td style="padding:0 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.line};border-radius:8px;border-collapse:separate;overflow:hidden;">
        ${detailRows([
          ["Full Name", esc(c.name)],
          ["Email", c.email ? link(`mailto:${c.email}`, c.email) : ""],
          ["Phone", c.phone ? link(`tel:${c.phone.replace(/[^\d+]/g, "")}`, c.phone) : ""],
          ["Location", esc(c.location)],
          ["Applied Position", esc(job.title)],
          ["Department", esc(job.department)],
          ["Total Experience", esc(c.totalExperience)],
          ["Current Company", esc(c.currentCompany)],
          ["Current Designation", esc(c.currentDesignation)],
          ["Current CTC", esc(c.currentCtc)],
          ["Expected CTC", esc(c.expectedCtc)],
          ["Notice Period", esc(c.noticePeriod)],
          ["Willing to Relocate", esc(c.willingToRelocate)],
          ["LinkedIn", c.linkedin ? link(c.linkedin.startsWith("http") ? c.linkedin : `https://${c.linkedin}`, "View profile") : ""],
        ])}
      </table>
    </td></tr>`;
    if (c.skills.length) {
      body += `
      <tr><td style="padding:14px 32px 0;">
        <div style="font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:${C.muted};margin-bottom:8px;">Key Skills</div>
        <div style="line-height:30px;">${c.skills
          .map(
            (s) =>
              `<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 10px;background:#FFFFFF;border:1px solid #CFE3D6;border-radius:999px;font-family:${FONT};font-size:12px;font-weight:600;color:${C.green};line-height:18px;">${esc(s)}</span>`
          )
          .join("")}</div>
      </td></tr>`;
    }
  }

  if (d.share.includes("AI Analysis Result")) {
    body += sectionTitle("AI Screening Summary");
    body += `
    <tr><td style="padding:0 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.line};border-radius:8px;">
        <tr><td style="padding:16px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="font-family:${FONT};font-size:13px;font-weight:700;color:${C.ink};">CV Match Score</td>
            <td align="right" style="font-family:${FONT};font-size:13px;font-weight:800;color:${tone.text};">${score}% · ${esc(a.result)}</td>
          </tr></table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;background:#E5E7EB;border-radius:999px;">
            <tr><td width="${score}%" style="height:8px;line-height:8px;font-size:0;background:${tone.bar};border-radius:999px;">&nbsp;</td>${
              score < 100 ? `<td style="height:8px;line-height:8px;font-size:0;">&nbsp;</td>` : ""
            }</tr>
          </table>
          ${
            a.summary
              ? `<p style="margin:14px 0 0;font-family:${FONT};font-size:13px;line-height:1.65;color:${C.body};">${esc(a.summary)}</p>`
              : ""
          }
        </td></tr>
      </table>
    </td></tr>`;
    if (a.strengths.length || a.gaps.length) {
      body += `
      <tr><td style="padding:12px 28px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="50%" valign="top" style="padding:4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;">
              <tr><td style="padding:12px 14px;">
                <div style="font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#166534;margin-bottom:6px;">Strengths</div>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">${
                  a.strengths.length ? bulletList(a.strengths, "&#10003;", "#16A34A") : bulletList(["—"], "", C.muted)
                }</table>
              </td></tr>
            </table>
          </td>
          <td width="50%" valign="top" style="padding:4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;">
              <tr><td style="padding:12px 14px;">
                <div style="font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#92400E;margin-bottom:6px;">Areas to Verify</div>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">${
                  a.gaps.length ? bulletList(a.gaps, "&#9679;", "#D97706") : bulletList(["No gaps flagged"], "", C.muted)
                }</table>
              </td></tr>
            </table>
          </td>
        </tr></table>
      </td></tr>`;
    }
  }

  if (d.share.includes("Screening Questions & Answers")) {
    body += sectionTitle("Screening Response");
    body += `
    <tr><td style="padding:0 32px;">
      <div style="font-family:${FONT};font-size:13px;font-weight:700;color:${C.ink};">Why are you interested in this role?</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;background:#F8FAFC;border-left:3px solid ${C.greenMid};border-radius:4px;">
        <tr><td style="padding:12px 14px;font-family:${FONT};font-size:13px;line-height:1.6;color:${d.whyInterested ? C.body : C.muted};font-style:${d.whyInterested ? "normal" : "italic"};">
          ${d.whyInterested ? esc(d.whyInterested).replace(/\n/g, "<br/>") : "The candidate did not answer this question."}
        </td></tr>
      </table>
    </td></tr>`;
    if (job.screeningQuestions.length) {
      body += `
      <tr><td style="padding:16px 32px 0;">
        <div style="font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:${C.muted};margin-bottom:6px;">Suggested Interview Questions</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">${job.screeningQuestions
          .map(
            (q, i) => `
          <tr>
            <td style="width:22px;vertical-align:top;padding:3px 0;font-family:${FONT};font-size:13px;font-weight:700;color:${C.orange};">${i + 1}.</td>
            <td style="padding:3px 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.body};">${esc(q)}</td>
          </tr>`
          )
          .join("")}</table>
      </td></tr>`;
    }
  }

  if (d.cvShared) {
    body += sectionTitle("Resume");
    body += `
    <tr><td style="padding:0 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px dashed ${d.cvFileName ? "#86C59B" : "#CBD5E1"};border-radius:8px;background:${d.cvFileName ? C.greenSoft : "#F8FAFC"};">
        <tr>
          <td width="44" style="padding:12px 0 12px 14px;" valign="middle">
            <div style="width:34px;height:40px;line-height:40px;text-align:center;background:${d.cvFileName ? "#DC2626" : "#94A3B8"};border-radius:4px;font-family:${FONT};font-size:10px;font-weight:800;color:#FFFFFF;">${esc(
              (d.cvFileName.split(".").pop() || "CV").slice(0, 4).toUpperCase()
            )}</div>
          </td>
          <td style="padding:12px 14px;" valign="middle">
            ${
              d.cvFileName
                ? `<div style="font-family:${FONT};font-size:13px;font-weight:700;color:${C.ink};">${esc(d.cvFileName)}</div>
                   <div style="font-family:${FONT};font-size:12px;color:${C.muted};margin-top:2px;">Attached to this email</div>`
                : `<div style="font-family:${FONT};font-size:13px;font-weight:700;color:${C.ink};">Resume could not be attached</div>
                   <div style="font-family:${FONT};font-size:12px;color:${C.muted};margin-top:2px;">Please view it in the admin panel under Applications &amp; AI Response.</div>`
            }
          </td>
        </tr>
      </table>
    </td></tr>`;
  }

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(
    `${c.name} · ${job.title} · ${score}% ${a.result} — forwarded by ${d.forwardedBy}`
  )}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
<tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid #DDE5E0;">

    <!-- Brand strip -->
    <tr><td style="height:5px;line-height:5px;font-size:0;background:${C.greenMid};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="70%" style="height:5px;line-height:5px;font-size:0;background:${C.greenMid};">&nbsp;</td>
        <td width="30%" style="height:5px;line-height:5px;font-size:0;background:${C.orange};">&nbsp;</td>
      </tr></table>
    </td></tr>

    <!-- Logo -->
    <tr><td align="center" style="padding:26px 32px 20px;">${header}</td></tr>

    <!-- Hero -->
    <tr><td style="padding:0 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.green};border-radius:12px;">
        <tr>
          <td style="padding:22px 22px;" valign="middle">
            <div style="font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#FBBF24;">Candidate Forwarded for Review</div>
            <div style="font-family:${FONT};font-size:24px;font-weight:800;color:#FFFFFF;margin-top:6px;line-height:1.25;">${esc(c.name)}</div>
            <div style="font-family:${FONT};font-size:14px;color:#D1FAE5;margin-top:4px;">${esc(job.title)}${
    job.department ? ` &nbsp;·&nbsp; ${esc(job.department)}` : ""
  }</div>
            <div style="margin-top:12px;">
              <span style="display:inline-block;padding:4px 10px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:999px;font-family:${FONT};font-size:11px;font-weight:700;color:#FFFFFF;letter-spacing:.4px;">${esc(
                d.applicationId
              )}</span>
            </div>
          </td>
          ${
            d.share.includes("AI Analysis Result")
              ? `<td width="120" align="center" valign="middle" style="padding:22px 22px 22px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border-radius:12px;">
              <tr><td align="center" style="padding:12px 16px;">
                <div style="font-family:${FONT};font-size:28px;font-weight:800;color:${tone.text};line-height:1;">${score}%</div>
                <div style="font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${C.muted};margin-top:4px;">AI Match</div>
                <div style="margin-top:6px;padding:3px 8px;background:${tone.bg};border-radius:999px;font-family:${FONT};font-size:10px;font-weight:700;color:${tone.text};white-space:nowrap;">${esc(
                  a.result
                )}</div>
              </td></tr>
            </table>
          </td>`
              : ""
          }
        </tr>
      </table>
    </td></tr>

    <!-- Greeting -->
    <tr><td style="padding:26px 32px 0;font-family:${FONT};font-size:14px;line-height:1.7;color:${C.body};">
      Dear HR Team,<br/>
      <b style="color:${C.ink};">${esc(d.forwardedBy)}</b> has forwarded <b style="color:${C.ink};">${esc(
    first
  )}</b>'s application for the <b style="color:${C.ink};">${esc(job.title)}</b> role for your review. The candidate's details are summarised below${
    d.cvShared && d.cvFileName ? " and the resume is attached" : ""
  }.
    </td></tr>

    <!-- Quick facts -->
    <tr><td style="padding:18px 28px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        ${factCell("Experience", c.totalExperience)}
        ${factCell("Location", c.location)}
        ${factCell("Notice Period", c.noticePeriod)}
        ${factCell("Expected CTC", c.expectedCtc)}
      </tr></table>
    </td></tr>

    ${body}

    <!-- Sign-off -->
    <tr><td style="padding:30px 32px 28px;font-family:${FONT};font-size:14px;line-height:1.7;color:${C.body};">
      Please update the candidate's status in the admin panel once reviewed.<br/><br/>
      Warm regards,<br/>
      <b style="color:${C.green};">Bharat Organic Expo</b><br/>
      <span style="font-size:12px;color:${C.muted};">Careers &amp; Talent Team</span>
    </td></tr>

    <!-- Footer -->
    <tr><td style="background:#0B2A18;padding:18px 32px;">
      <div style="font-family:${FONT};font-size:12px;font-weight:700;color:#FFFFFF;">Bharat Organic Expo</div>
      <div style="font-family:${FONT};font-size:11px;line-height:1.6;color:#9CB8A6;margin-top:4px;">
        Forwarded by ${esc(d.forwardedBy)} on ${esc(formatDateTime(d.forwardedAt))} IST.<br/>
        This email contains confidential candidate information intended only for the hiring team. Please do not share it outside the organisation.
      </div>
    </td></tr>

  </table>
</td></tr>
</table>
</body></html>`;

  // Plain-text version for mail apps that don't show HTML.
  const lines = [
    `Candidate forwarded for review: ${c.name} – ${job.title} (${d.applicationId})`,
    `Forwarded by ${d.forwardedBy} on ${formatDateTime(d.forwardedAt)} IST`,
    d.note ? `\nNote: ${d.note}` : "",
    d.share.includes("Application Form Details")
      ? `\nEmail: ${c.email}\nPhone: ${c.phone}\nLocation: ${c.location}\nExperience: ${c.totalExperience}\nNotice period: ${c.noticePeriod}\nExpected CTC: ${c.expectedCtc}`
      : "",
    d.share.includes("AI Analysis Result") ? `\nAI match: ${score}% (${a.result})\n${a.summary}` : "",
    d.share.includes("Screening Questions & Answers") && d.whyInterested ? `\nWhy interested: ${d.whyInterested}` : "",
    d.cvShared ? (d.cvFileName ? `\nResume attached: ${d.cvFileName}` : "\nResume could not be attached.") : "",
    "\n— Bharat Organic Expo",
  ];

  return { subject, html, text: lines.filter(Boolean).join("\n") };
};
