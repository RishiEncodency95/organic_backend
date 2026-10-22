import fs from "fs";
import path from "path";
import EmailLog from "../models/careers/EmailLog.model";
import { downloadFileBuffer } from "../modules/files/files.controller";
import CareerHrSettings from "../models/careers/CareerHrSettings.model";
import CareerResultMessages from "../models/careers/CareerResultMessages.model";
import { getTransporter } from "./email.service";
import { renderCandidateSubmittedEmail, renderHrNewApplicationEmail, type SubmissionEmailData } from "./templates/careerSubmissionEmails";

/*
 * Sends the two "application submitted" emails: the confirmation to the candidate and the
 * new-application notice to the HR recipients set in Career Settings → HR & Workflow.
 */

const text = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const strings = (v: unknown) => (Array.isArray(v) ? v.map(text).filter(Boolean) : []);
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);

/** A file saved by this server under public/uploads ("/uploads/…"), or null */
function readUpload(src: string): Buffer | null {
  if (!src.startsWith("/uploads/")) return null;
  const root = path.resolve(process.cwd(), "public", "uploads");
  const file = path.resolve(root, "." + src.slice("/uploads".length));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return null;
  return fs.readFileSync(file);
}

const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Local photos become data: URLs so the template can embed them */
function photoSource(src: string): string {
  const local = readUpload(src);
  if (!local) return src;
  const ext = src.split(".").pop()?.toLowerCase() || "";
  return MIME[ext] ? `data:${MIME[ext]};base64,${local.toString("base64")}` : "";
}

/** The CV file itself, for the HR email (max 10 MB) */
async function cvFile(url: string): Promise<Buffer | null> {
  const file = readUpload(url) || (url ? await downloadFileBuffer(url) : null);
  return file && file.length <= 10 * 1024 * 1024 ? file : null;
}

/** A link HR can open: full URLs as they are, uploads only when the API's public address is set */
function publicLink(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = text(process.env.PUBLIC_API_URL).replace(/\/$/, "");
  return base && url.startsWith("/uploads/") ? base + url : "";
}

/** Opens without an error (a dead link must not reach HR) */
async function reachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function cvDetails(candidate: any): Promise<SubmissionEmailData["cv"]> {
  const stored = text(candidate.cv?.cloudinaryUrl);
  const file = await cvFile(stored);
  let url = publicLink(stored);
  if (url && !file && !(await reachable(url))) url = "";
  return { fileName: text(candidate.cv?.originalFileName) || "Resume.pdf", size: formatSize(Number(candidate.cv?.fileSize) || 0), url, file };
}

const formatSize = (bytes: number) => (!bytes ? "" : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`);

/** Everything the two templates show, from the saved records */
export async function buildSubmissionEmailData(application: any, candidate: any, job: any, analysis: any): Promise<SubmissionEmailData> {
  const messages: any = await CareerResultMessages.findOne({ key: "default" }).lean().catch(() => null);
  const b = analysis?.breakdown || {};
  const details = application?.applicationDetails || {};
  const highlights = [...strings(analysis?.matchedRequirements), ...strings(analysis?.strengths)];
  return {
    applicationId: text(application.applicationId),
    submittedAt: application.submittedAt || new Date(),
    candidate: {
      name: text(candidate.name) || "Candidate",
      email: text(candidate.email),
      phone: text(candidate.verifiedPhone) || text(candidate.phone),
      location: text(candidate.location),
      gender: text(candidate.gender),
      linkedin: text(candidate.linkedin),
      photo: photoSource(text(candidate.photo)),
    },
    job: { title: text(job?.title) || "the applied position", location: text(job?.location) },
    preferredLocations: strings(details.preferredLocations),
    analysis: {
      score: num(analysis?.matchScore),
      summary: text(analysis?.explanation),
      breakdown: {
        education: num(b.education?.score),
        experience: num(b.relevantExperience?.score),
        skills: num(b.skills?.score),
        industry: num(b.industryExperience?.score),
        location: num(b.location?.score),
        roleFit: num(b.roleFit?.score),
      },
      highlights: [...new Set(highlights)].slice(0, 6),
    },
    cv: await cvDetails(candidate),
    support: {
      email: text(messages?.supportEmail) || "careers@bharatorganicexpo.com",
      // Same defaults as Career Settings → Result Messages when nothing is saved yet
      phone: messages ? text(messages.supportPhone) : "+91 96549 00525",
    },
    siteUrl: text(process.env.SITE_URL) || "https://bharatorganicexpo.com",
  };
}

const sender = () => {
  const fromName = process.env.FROM_NAME || "Bharat Organic Expo Careers";
  const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || "noreply@bharatorganicexpo.com";
  return `"${fromName}" <${fromEmail}>`;
};

/** HR recipients (To / CC / BCC) from Career Settings; the admin address when none are set */
export async function hrRecipients(): Promise<{ to: string[]; cc: string[]; bcc: string[] }> {
  // Fixed HR address from .env (CAREER_HR_EMAIL), used instead of Career Settings when set
  const fixed = text(process.env.CAREER_HR_EMAIL);
  if (fixed) return { to: fixed.split(",").map((e) => e.trim()).filter(Boolean), cc: [], bcc: [] };
  const settings: any = await CareerHrSettings.findOne({ key: "default" }).lean().catch(() => null);
  const active = (settings?.recipients || []).filter((r: any) => r?.active !== false && text(r?.email));
  const pick = (type: string) => active.filter((r: any) => (r.type || "to") === type).map((r: any) => text(r.email));
  const out = { to: pick("to"), cc: pick("cc"), bcc: pick("bcc") };
  if (!out.to.length) {
    const fallback = out.cc.shift() || out.bcc.shift() || process.env.CONTACT_ADMIN_EMAIL || process.env.SMTP_USER || "";
    if (fallback) out.to.push(fallback);
  }
  return out;
}

async function send(template: string, logRecipient: string, mail: Record<string, unknown>) {
  const log = await EmailLog.create({ recipient: logRecipient, subject: String(mail.subject), template, status: "QUEUED" }).catch(() => null);
  const transporter = getTransporter();
  if (!transporter) {
    console.warn(`[EMAIL SKIPPED] ${template}: no SMTP credentials.`);
    return false;
  }
  try {
    await transporter.sendMail({ from: sender(), ...mail });
    if (log) {
      log.status = "SENT";
      log.sentAt = new Date();
      await log.save();
    }
    return true;
  } catch (err) {
    console.error(`${template} email error:`, err);
    if (log) {
      log.status = "FAILED";
      log.error = (err as Error).message;
      await log.save();
    }
    return false;
  }
}

export async function sendCandidateSubmittedEmail(data: SubmissionEmailData) {
  // Fixed candidate address from .env (CAREER_CANDIDATE_EMAIL), e.g. while testing; else the CV's email
  const to = text(process.env.CAREER_CANDIDATE_EMAIL) || data.candidate.email;
  if (!to) return false;
  const email = renderCandidateSubmittedEmail(data);
  return send("CANDIDATE_APPLICATION_CONFIRMATION", to, {
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    attachments: email.attachments,
  });
}

export async function sendHrNewApplicationEmail(data: SubmissionEmailData) {
  const r = await hrRecipients();
  if (!r.to.length) return false;
  const email = renderHrNewApplicationEmail(data);
  return send("HR_NEW_APPLICATION", r.to.join(", "), {
    to: r.to,
    cc: r.cc.length ? r.cc : undefined,
    bcc: r.bcc.length ? r.bcc : undefined,
    // HR can reply straight to the candidate
    replyTo: data.candidate.email || undefined,
    subject: email.subject,
    html: email.html,
    text: email.text,
    attachments: [
      ...email.attachments,
      ...(data.cv.file ? [{ filename: data.cv.fileName, content: data.cv.file }] : []),
    ],
  });
}
