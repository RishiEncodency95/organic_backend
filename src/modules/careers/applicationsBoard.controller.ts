import { Request, Response } from "express";
import Application from "../../models/careers/Application.model";
import CvAnalysis from "../../models/careers/CvAnalysis.model";
import ApplicationEvent from "../../models/careers/ApplicationEvent.model";
import { getHrSettingsDoc } from "./hrSettings.controller";
import { sendHrForwardEmail } from "../../services/email.service";
import { downloadFileBuffer } from "../files/files.controller";
import { getEmailLogo, LOGO_CID, renderHrForwardEmail } from "../../services/templates/hrForwardEmail";

/**
 * Data for the admin "Applications & AI Response" screen: one flat row per candidate, from
 * everything the /careers flow saves —
 *   - applications (submitted, or started but not submitted), and
 *   - CV uploads that were AI-checked but never turned into an application ("CV Uploaded").
 */

const HR_STATUSES = [
  "Not Forwarded",
  "Sent to HR",
  "Under Review",
  "Shortlisted",
  "Interview",
  "Selected",
  "On Hold",
  "Rejected",
];

// Same bands as the admin Careers Dashboard: Eligible >= 60, Partial Match 50-59.
const aiResultFor = (score: number) =>
  score >= 60 ? "Eligible" : score >= 50 ? "Partial Match" : "Not Eligible";

const SUBMITTED_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "INTERVIEW", "SELECTED", "REJECTED"];

const formatDate = (d?: Date) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "";
const formatTime = (d?: Date) =>
  d ? new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }) : "";

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const baseRow = (candidate: any, job: any, analysis: any, scoreFallback?: number) => {
  const score = Math.round(Number(analysis?.matchScore ?? scoreFallback ?? 0)) || 0;
  return {
    name: text(candidate?.name) || "Unnamed candidate",
    email: text(candidate?.email),
    phone: text(candidate?.verifiedPhone) || text(candidate?.phone),
    avatar: text(candidate?.photo),
    location: text(candidate?.location),
    experienceYrs: text(candidate?.totalExperience),
    currentCompany: text(candidate?.currentCompany),
    currentDesignation: text(candidate?.currentDesignation),
    currentCtc: text(candidate?.currentCTC),
    expectedCtc: text(candidate?.expectedCTC),
    noticePeriod: text(candidate?.noticePeriod),
    willingToRelocate: candidate?.willingToRelocate ? "Yes" : "No",
    skills: Array.isArray(candidate?.skills) ? candidate.skills : [],
    cvUrl: text(candidate?.cv?.cloudinaryUrl),
    cvFileName: text(candidate?.cv?.originalFileName),
    cvFileSize: Number(candidate?.cv?.fileSize) || 0,
    position: text(job?.title) || "Unknown position",
    department: text(job?.department),
    jobCode: text(job?.jobCode) || text(job?.slug),
    jobId: job?._id ? String(job._id) : "",
    aiScore: score,
    aiResult: aiResultFor(score),
    aiAnalysisSummary: text(analysis?.explanation),
    strengths: Array.isArray(analysis?.strengths) ? analysis.strengths : [],
    gaps: Array.isArray(analysis?.gaps) ? analysis.gaps : [],
  };
};

export const getAdminApplicationsBoard = async (_req: Request, res: Response): Promise<void> => {
  try {
    const applications: any[] = await Application.find()
      .populate("candidateId")
      .populate("jobId")
      .populate("cvAnalysisId")
      .sort({ createdAt: -1 })
      .lean();

    const rows: any[] = [];
    const appliedKeys = new Set<string>();

    for (const app of applications) {
      const candidate = app.candidateId || app.candidateSnapshot || {};
      const job = app.jobId || {};
      const analysis = app.cvAnalysisId || app.scoreSnapshot || {};
      const appliedAt: Date = app.submittedAt || app.createdAt;
      const candidateKey = text(candidate?.email) || String(candidate?._id || "");
      appliedKeys.add(`${candidateKey}|${job?._id || ""}`);
      if (app.candidateId?._id) appliedKeys.add(`${app.candidateId._id}|${job?._id || ""}`);

      rows.push({
        id: app.applicationId,
        source: "application",
        ...baseRow(candidate, job, analysis, app.scoreSnapshot?.matchScore),
        stage: SUBMITTED_STATUSES.includes(app.status) ? "Submitted" : "Incomplete",
        status: app.status,
        hrStatus: HR_STATUSES.includes(app.hrStatus) ? app.hrStatus : "Not Forwarded",
        updatedByHrOn: app.hrUpdatedAt
          ? `${formatDate(app.hrUpdatedAt)}, ${formatTime(app.hrUpdatedAt)}${app.hrUpdatedBy ? ` by ${app.hrUpdatedBy}` : ""}`
          : "",
        whyInterested: text(app.whyInterested),
        notes: text(app.notes),
        hrForward: app.hrForward?.forwardedAt ? app.hrForward : null,
        appliedAt,
        appliedOn: formatDate(appliedAt),
        appliedTime: formatTime(appliedAt),
      });
    }

    // CV checks that never became an application: newest one per candidate + job.
    const analyses: any[] = await CvAnalysis.find({ status: "COMPLETED" })
      .populate("candidateId")
      .populate("jobId")
      .sort({ createdAt: -1 })
      .lean();

    const seen = new Set<string>();
    for (const an of analyses) {
      const candidate = an.candidateId;
      const job = an.jobId;
      if (!candidate || !job) continue;
      const byEmail = `${text(candidate.email) || String(candidate._id)}|${job._id}`;
      const byId = `${candidate._id}|${job._id}`;
      if (appliedKeys.has(byEmail) || appliedKeys.has(byId) || seen.has(byEmail)) continue;
      seen.add(byEmail);

      const uploadedAt: Date = an.analyzedAt || an.createdAt;
      rows.push({
        id: String(an._id),
        source: "cv",
        ...baseRow(candidate, job, an),
        stage: "CV Uploaded",
        status: "CV_UPLOADED",
        hrStatus: "Not Forwarded",
        updatedByHrOn: "",
        whyInterested: "",
        notes: "",
        appliedAt: uploadedAt,
        appliedOn: formatDate(uploadedAt),
        appliedTime: formatTime(uploadedAt),
      });
    }

    rows.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());

    res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load applications.",
      error: (error as Error).message,
    });
  }
};

const findApplication = async (id: string) => {
  let application = await Application.findOne({ applicationId: id });
  if (!application && /^[0-9a-fA-F]{24}$/.test(id)) application = await Application.findById(id);
  return application;
};

// Parts of an application the admin can choose to share when forwarding to HR.
const SHAREABLE = ["Application Form Details", "Uploaded CV (Resume)", "AI Analysis Result", "Screening Questions & Answers"];

const recipientLabel = (r: any) =>
  `${r.name || r.email}${r.designation ? ` (${r.designation})` : ""} <${r.email}>${r.type && r.type !== "to" ? ` · ${String(r.type).toUpperCase()}` : ""}`;

const strings = (v: unknown) => (Array.isArray(v) ? v.map((x) => text(String(x ?? ""))).filter(Boolean) : []);

// Email sent to the HR recipients; only the parts the admin ticked are included.
const buildForwardEmail = async (application: any, share: string[], note: string, forwardedBy: string) => {
  await application.populate([{ path: "candidateId" }, { path: "jobId" }, { path: "cvAnalysisId" }]);
  const candidate: any = application.candidateId || application.candidateSnapshot || {};
  const job: any = application.jobId || {};
  const analysis: any = application.cvAnalysisId || application.scoreSnapshot || {};
  const score = Math.round(Number(analysis?.matchScore ?? 0)) || 0;

  const attachments: { filename: string; content: Buffer; cid?: string; contentType?: string }[] = [];
  const logo = getEmailLogo();
  if (logo) attachments.push({ filename: "bharat-organic-expo.png", content: logo, cid: LOGO_CID, contentType: "image/png" });

  const cvShared = share.includes("Uploaded CV (Resume)");
  let cvFileName = "";
  if (cvShared) {
    const cvUrl = text(candidate?.cv?.cloudinaryUrl);
    const file = cvUrl ? await downloadFileBuffer(cvUrl) : null;
    if (file) {
      cvFileName = text(candidate.cv.originalFileName) || cvUrl.split("/").pop() || "resume.pdf";
      attachments.push({ filename: cvFileName, content: file });
    }
  }

  const content = renderHrForwardEmail({
    applicationId: application.applicationId,
    forwardedBy,
    forwardedAt: application.hrUpdatedAt || new Date(),
    note,
    share,
    candidate: {
      name: text(candidate.name) || "Candidate",
      email: text(candidate.email),
      phone: text(candidate.verifiedPhone) || text(candidate.phone),
      location: text(candidate.location),
      linkedin: text(candidate.linkedin),
      totalExperience: text(candidate.totalExperience),
      currentCompany: text(candidate.currentCompany),
      currentDesignation: text(candidate.currentDesignation),
      currentCtc: text(candidate.currentCTC),
      expectedCtc: text(candidate.expectedCTC),
      noticePeriod: text(candidate.noticePeriod),
      willingToRelocate: candidate.willingToRelocate ? "Yes" : "No",
      skills: strings(candidate.skills),
    },
    job: {
      title: text(job.title) || "Unknown position",
      department: text(job.department),
      screeningQuestions: strings(job.screeningQuestions),
    },
    analysis: {
      score,
      result: aiResultFor(score),
      summary: text(analysis.explanation),
      strengths: strings(analysis.strengths),
      gaps: strings(analysis.gaps),
    },
    whyInterested: text(application.whyInterested),
    cvFileName,
    cvShared,
    hasLogo: !!logo,
  });

  return { ...content, attachments };
};

export const updateAdminApplicationHr = async (req: Request, res: Response): Promise<void> => {
  try {
    const { hrStatus, note, changedBy, forward } = req.body || {};
    if (!HR_STATUSES.includes(hrStatus)) {
      res.status(400).json({ success: false, message: `hrStatus must be one of: ${HR_STATUSES.join(", ")}` });
      return;
    }
    const application = await findApplication(String(req.params.id));
    if (!application) {
      res.status(404).json({ success: false, message: "Application not found." });
      return;
    }

    const oldHrStatus = application.hrStatus || "Not Forwarded";
    application.hrStatus = hrStatus;
    application.hrUpdatedAt = new Date();
    application.hrUpdatedBy = text(changedBy) || "Admin";

    // Sent from the "Forward to HR" form: recipients are emails from Career Settings → HR & Workflow.
    let mail: { to: string[]; cc: string[]; bcc: string[]; share: string[]; note: string } | null = null;
    let notifyHr = false;
    if (forward && typeof forward === "object") {
      const settings: any = await getHrSettingsDoc();
      if (settings.manualForward === false) {
        res.status(403).json({ success: false, message: "Manual forward to HR is turned off in Career Settings → HR & Workflow." });
        return;
      }
      const wanted = new Set(
        (Array.isArray(forward.recipients) ? forward.recipients : []).map((e: unknown) => text(e).toLowerCase())
      );
      const chosen = (settings.recipients || []).filter((r: any) => r.active !== false && wanted.has(r.email));
      const share = (Array.isArray(forward.share) ? forward.share : []).map(text).filter((x: string) => SHAREABLE.includes(x));
      if (chosen.length === 0 || share.length === 0) {
        res.status(400).json({ success: false, message: "Choose at least one HR recipient and one item to share." });
        return;
      }
      const byType = (t: string) => chosen.filter((r: any) => (r.type || "to") === t).map((r: any) => r.email as string);
      mail = { to: byType("to"), cc: byType("cc"), bcc: byType("bcc"), share, note: text(forward.note) };
      // An email needs a To address; if only CC/BCC people were picked, the first one becomes To.
      if (mail.to.length === 0) {
        const first = mail.cc.shift() || mail.bcc.shift();
        if (first) mail.to.push(first);
      }
      notifyHr = settings.notifyHr !== false;
      application.hrForward = {
        recipients: chosen.map(recipientLabel),
        share,
        note: mail.note,
        forwardedAt: application.hrUpdatedAt,
        forwardedBy: application.hrUpdatedBy,
      };
    }
    await application.save();

    let email: { sent: boolean; error?: string; skipped?: boolean } | null = null;
    if (mail) {
      if (notifyHr) {
        const content = await buildForwardEmail(application, mail.share, mail.note, application.hrUpdatedBy || "Admin");
        email = await sendHrForwardEmail({ to: mail.to, cc: mail.cc, bcc: mail.bcc, ...content });
      } else {
        email = { sent: false, skipped: true };
      }
    }

    await ApplicationEvent.create({
      applicationId: application.applicationId,
      oldStatus: `HR: ${oldHrStatus}`,
      newStatus: `HR: ${hrStatus}`,
      changedBy: application.hrUpdatedBy,
      note: text(note) || `HR status changed to ${hrStatus}`,
    });

    res.status(200).json({
      success: true,
      message: `HR status updated to ${hrStatus}`,
      data: { application, email, recipients: mail ? { to: mail.to, cc: mail.cc, bcc: mail.bcc } : null },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update HR status.",
      error: (error as Error).message,
    });
  }
};

export const addAdminApplicationNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const note = text(req.body?.note);
    if (!note) {
      res.status(400).json({ success: false, message: "Note cannot be empty." });
      return;
    }
    const application = await findApplication(String(req.params.id));
    if (!application) {
      res.status(404).json({ success: false, message: "Application not found." });
      return;
    }
    const by = text(req.body?.changedBy) || "Admin";
    application.notes = [application.notes, `[${new Date().toISOString()}] ${by}: ${note}`].filter(Boolean).join("\n");
    await application.save();

    await ApplicationEvent.create({
      applicationId: application.applicationId,
      oldStatus: application.status,
      newStatus: application.status,
      changedBy: by,
      note,
    });

    res.status(200).json({ success: true, message: "Note added.", data: application });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to add note.",
      error: (error as Error).message,
    });
  }
};
