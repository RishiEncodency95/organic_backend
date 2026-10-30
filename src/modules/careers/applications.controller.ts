import { Request, Response } from "express";
import Application from "../../models/careers/Application.model";
import CandidateProfile from "../../models/careers/CandidateProfile.model";
import Job from "../../models/careers/Job.model";
import CvAnalysis from "../../models/careers/CvAnalysis.model";
import Counter from "../../models/careers/Counter.model";
import ApplicationEvent from "../../models/careers/ApplicationEvent.model";
import { HR_STATUSES } from "./applicationsBoard.controller";
import { buildSubmissionEmailData, sendCandidateSubmittedEmail, sendHrNewApplicationEmail } from "../../services/careerSubmissionMail.service";

/**
 * Generate unique, server-side sequential Application ID: BOE<current year>-000001
 */
export const generateNextApplicationId = async (): Promise<string> => {
  const counter = await Counter.findOneAndUpdate(
    { _id: "applicationId_seq" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const seqStr = String(counter.seq).padStart(6, "0");
  const year = new Date().getFullYear();
  return `BOE${year}-${seqStr}`;
};

export const createApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const { candidateId, jobId, cvAnalysisId, candidateData, whyInterested } = req.body;

    if (!candidateId || !jobId) {
      res.status(400).json({ success: false, message: "candidateId and jobId are required." });
      return;
    }

    const candidate = await CandidateProfile.findById(candidateId);
    if (!candidate) {
      res.status(404).json({ success: false, message: "Candidate profile not found." });
      return;
    }

    let job = await Job.findById(jobId);
    if (!job) {
      job = await Job.findOne({ slug: jobId });
    }

    if (!job) {
      res.status(404).json({ success: false, message: "Job position not found." });
      return;
    }

    // Update candidate profile fields if user modified form
    if (candidateData) {
      if (candidateData.name) candidate.name = candidateData.name;
      if (candidateData.email) candidate.email = candidateData.email;
      if (candidateData.phone) candidate.phone = candidateData.phone;
      // Set on the eligibility screen: the photo the candidate added and every number
      // their CV listed, including the one the WhatsApp OTP proved.
      if (candidateData.photo) candidate.photo = candidateData.photo;
      if (candidateData.verifiedPhone) candidate.verifiedPhone = candidateData.verifiedPhone;
      if (Array.isArray(candidateData.phones) && candidateData.phones.length > 0) {
        candidate.phones = candidateData.phones;
      }
      if (candidateData.location) candidate.location = candidateData.location;
      if (candidateData.currentCompany !== undefined) candidate.currentCompany = candidateData.currentCompany;
      if (candidateData.currentDesignation !== undefined) candidate.currentDesignation = candidateData.currentDesignation;
      if (candidateData.totalExperience !== undefined) candidate.totalExperience = candidateData.totalExperience;
      if (candidateData.noticePeriod !== undefined) candidate.noticePeriod = candidateData.noticePeriod;
      if (candidateData.expectedCTC !== undefined) candidate.expectedCTC = candidateData.expectedCTC;
      if (candidateData.willingToRelocate !== undefined) candidate.willingToRelocate = candidateData.willingToRelocate;
      if (candidateData.skills) candidate.skills = candidateData.skills;
      if (candidateData.education) candidate.education = candidateData.education;
      await candidate.save();
    }

    // Check if draft or existing application exists
    let application = await Application.findOne({
      candidateId: candidate._id,
      jobId: job._id,
      status: { $in: ["DRAFT", "CV_UPLOADED", "AI_ANALYZING", "AI_COMPLETED", "APPLICATION_IN_PROGRESS"] },
    });

    if (!application) {
      const tempAppId = await generateNextApplicationId();
      application = await Application.create({
        applicationId: tempAppId,
        candidateId: candidate._id,
        jobId: job._id,
        cvAnalysisId: cvAnalysisId || undefined,
        status: "APPLICATION_IN_PROGRESS",
        whyInterested: whyInterested || "",
      });
    } else {
      if (cvAnalysisId) application.cvAnalysisId = cvAnalysisId;
      if (whyInterested) application.whyInterested = whyInterested;
      await application.save();
    }

    res.status(200).json({
      success: true,
      message: "Application drafted successfully.",
      data: application,
    });
  } catch (error) {
    console.error("Create application error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process candidate application.",
      error: (error as Error).message,
    });
  }
};

export const getApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetId = String(req.params.id);
    let application = await Application.findOne({ applicationId: targetId })
      .populate("candidateId")
      .populate("jobId")
      .populate("cvAnalysisId");

    if (!application && targetId.match(/^[0-9a-fA-F]{24}$/)) {
      application = await Application.findById(targetId)
        .populate("candidateId")
        .populate("jobId")
        .populate("cvAnalysisId");
    }

    if (!application) {
      res.status(404).json({ success: false, message: "Application not found." });
      return;
    }

    res.status(200).json({
      success: true,
      data: application,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch application details.",
      error: (error as Error).message,
    });
  }
};

export const updateApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetId = String(req.params.id);
    const { candidateData, whyInterested, notes } = req.body;

    let application = await Application.findOne({ applicationId: targetId });
    if (!application && targetId.match(/^[0-9a-fA-F]{24}$/)) {
      application = await Application.findById(targetId);
    }

    if (!application) {
      res.status(404).json({ success: false, message: "Application not found." });
      return;
    }

    if (application.candidateId && candidateData) {
      await CandidateProfile.findByIdAndUpdate(application.candidateId, candidateData);
    }

    if (whyInterested !== undefined) application.whyInterested = whyInterested;
    if (notes !== undefined) application.notes = notes;

    await application.save();

    res.status(200).json({
      success: true,
      message: "Application details updated successfully.",
      data: application,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update application.",
      error: (error as Error).message,
    });
  }
};

export const submitApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetId = String(req.params.id);
    const { candidateData, whyInterested, applicationDetails } = req.body;

    let application = await Application.findOne({ applicationId: targetId })
      .populate("candidateId")
      .populate("jobId")
      .populate("cvAnalysisId");

    if (!application && targetId.match(/^[0-9a-fA-F]{24}$/)) {
      application = await Application.findById(targetId)
        .populate("candidateId")
        .populate("jobId")
        .populate("cvAnalysisId");
    }

    if (!application) {
      res.status(404).json({ success: false, message: "Application not found." });
      return;
    }

    const candidate = await CandidateProfile.findById(application.candidateId);
    if (!candidate) {
      res.status(404).json({ success: false, message: "Candidate profile missing." });
      return;
    }

    const job = await Job.findById(application.jobId);
    if (!job || job.status === "CLOSED") {
      res.status(400).json({
        success: false,
        message: "This position is currently closed for applications.",
      });
      return;
    }

    // Apply any final form field updates
    if (candidateData) {
      if (candidateData.name) candidate.name = candidateData.name;
      if (candidateData.email) candidate.email = candidateData.email;
      if (candidateData.phone) candidate.phone = candidateData.phone;
      // Set on the eligibility screen: the photo the candidate added and every number
      // their CV listed, including the one the WhatsApp OTP proved.
      if (candidateData.photo) candidate.photo = candidateData.photo;
      if (candidateData.verifiedPhone) candidate.verifiedPhone = candidateData.verifiedPhone;
      if (Array.isArray(candidateData.phones) && candidateData.phones.length > 0) {
        candidate.phones = candidateData.phones;
      }
      if (candidateData.location) candidate.location = candidateData.location;
      if (candidateData.currentCompany !== undefined) candidate.currentCompany = candidateData.currentCompany;
      if (candidateData.currentDesignation !== undefined) candidate.currentDesignation = candidateData.currentDesignation;
      if (candidateData.totalExperience !== undefined) candidate.totalExperience = candidateData.totalExperience;
      if (candidateData.noticePeriod !== undefined) candidate.noticePeriod = candidateData.noticePeriod;
      if (candidateData.expectedCTC !== undefined) candidate.expectedCTC = candidateData.expectedCTC;
      if (candidateData.willingToRelocate !== undefined) candidate.willingToRelocate = candidateData.willingToRelocate;
      if (candidateData.skills) candidate.skills = candidateData.skills;
      if (candidateData.education) candidate.education = candidateData.education;
      await candidate.save();
    }

    if (whyInterested) {
      application.whyInterested = whyInterested;
    }
    if (applicationDetails && typeof applicationDetails === "object" && !Array.isArray(applicationDetails)) {
      // Only plain answers; capped so a crafted request cannot bloat the record
      const json = JSON.stringify(applicationDetails);
      if (json.length <= 20_000) application.applicationDetails = JSON.parse(json);
    }

    // Validate essential contact fields
    if (!candidate.name || !candidate.email || !candidate.phone) {
      res.status(400).json({
        success: false,
        message: "Please complete candidate Name, Email, and Phone before submitting.",
      });
      return;
    }

    const analysis = application.cvAnalysisId
      ? await CvAnalysis.findById(application.cvAnalysisId)
      : null;

    // Freeze candidate and score snapshot
    application.candidateSnapshot = candidate.toObject();
    application.scoreSnapshot = analysis
      ? {
          matchScore: analysis.matchScore,
          eligibilityThreshold: analysis.eligibilityThreshold,
          eligible: analysis.eligible,
          breakdown: analysis.breakdown,
          matchedRequirements: analysis.matchedRequirements,
          missingRequirements: analysis.missingRequirements,
          strengths: analysis.strengths,
          gaps: analysis.gaps,
        }
      : { matchScore: 0, eligible: false };

    const oldStatus = application.status;
    application.status = "SUBMITTED";
    application.submittedAt = new Date();
    await application.save();

    // Create Audit Log Event
    await ApplicationEvent.create({
      applicationId: application.applicationId,
      oldStatus,
      newStatus: "SUBMITTED",
      changedBy: candidate.name || "Candidate",
      note: "Application submitted successfully by candidate.",
    });

    // Confirmation to the candidate + new-application notice to HR (in the background)
    buildSubmissionEmailData(application, candidate, job, analysis)
      .then((data) =>
        Promise.all([
          sendCandidateSubmittedEmail(data).catch((err) => console.error("Candidate email background send error:", err)),
          sendHrNewApplicationEmail(data).catch((err) => console.error("HR email background send error:", err)),
        ])
      )
      .catch((err) => console.error("Submission email build error:", err));

    res.status(200).json({
      success: true,
      message: "Application submitted successfully.",
      data: {
        applicationId: application.applicationId,
        status: "SUBMITTED",
        submittedAt: application.submittedAt,
      },
    });
  } catch (error) {
    console.error("Submit application error:", error);
    res.status(500).json({
      success: false,
      message: "Submission failed. Please try again.",
      error: (error as Error).message,
    });
  }
};

// INTEGRATION CONTROLLERS (server-to-server, e.g. HR-CRM pulling applied candidates)

/**
 * GET /api/careers/integrations/applications — API-key gated (see requireIntegrationApiKey).
 * Mirrors the shape/intent of GET /api/careers/jobs, but for the pull direction HR-CRM uses
 * to bring applied candidates + resumes into its own pipeline. Only applications that have
 * actually been SUBMITTED (or moved further along) are returned — drafts/in-progress forms
 * aren't real applicants yet. Supports `?since=<ISO date>` so a caller can pull only what
 * changed since its last sync instead of the full list every time.
 */
export const listIntegrationApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const { since } = req.query;
    const filter: any = { status: { $ne: "DRAFT" }, submittedAt: { $exists: true, $ne: null } };
    if (since && !isNaN(Date.parse(String(since)))) {
      filter.updatedAt = { $gte: new Date(String(since)) };
    }

    const applications = await Application.find(filter)
      .populate("candidateId")
      .populate("jobId", "_id title")
      .populate("cvAnalysisId", "matchScore")
      .sort({ submittedAt: -1 })
      .lean();

    const data = applications
      .filter((app: any) => app.candidateId && app.jobId)
      .map((app: any) => {
        const candidate = app.candidateId;
        const job = app.jobId;
        return {
          _id: String(app._id),
          applicationId: app.applicationId,
          jobId: String(job._id),
          jobTitle: job.title,
          status: app.status,
          submittedAt: app.submittedAt,
          matchScore: app.cvAnalysisId?.matchScore ?? app.scoreSnapshot?.matchScore,
          candidate: {
            name: candidate.name || "",
            email: candidate.email || "",
            phone: candidate.phone || candidate.verifiedPhone || "",
            location: candidate.location || "",
            photo: candidate.photo || "",
            resumeUrl: candidate.cv?.cloudinaryUrl || "",
            resumeFileName: candidate.cv?.originalFileName || "",
            skills: candidate.skills || [],
            education: candidate.education || [],
            experience: candidate.experience || [],
            currentCompany: candidate.currentCompany || "",
            currentDesignation: candidate.currentDesignation || "",
            totalExperience: candidate.totalExperience || "",
            noticePeriod: candidate.noticePeriod || "",
            currentCTC: candidate.currentCTC || "",
            expectedCTC: candidate.expectedCTC || "",
            linkedin: candidate.linkedin || "",
          },
        };
      });

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    console.error("List integration applications error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch applications.",
      error: (error as Error).message,
    });
  }
};

/**
 * PATCH /api/careers/integrations/applications/:id/status — API-key gated.
 * Mirrors updateAdminApplicationHr, but for HR-CRM pushing a recruitment-stage change it made
 * on its own Candidate record back here (see syncCareerSiteApplicants / pushCandidateStatusToCareerSite
 * in crewcam-backend), so hrStatus stays in sync in both directions without a human re-entering it
 * on both sides. Only ever touches `hrStatus` — never `status`, which tracks the candidate's own
 * self-service progress through the public apply form and must stay HR-CRM-untouched.
 */
export const updateIntegrationApplicationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { hrStatus } = req.body || {};
    if (!HR_STATUSES.includes(hrStatus)) {
      res.status(400).json({ success: false, message: `hrStatus must be one of: ${HR_STATUSES.join(", ")}` });
      return;
    }

    const application = await Application.findById(req.params.id);
    if (!application) {
      res.status(404).json({ success: false, message: "Application not found." });
      return;
    }

    const oldHrStatus = application.hrStatus || "Not Forwarded";
    application.hrStatus = hrStatus;
    application.hrUpdatedAt = new Date();
    application.hrUpdatedBy = "HR-CRM";
    await application.save();

    await ApplicationEvent.create({
      applicationId: application.applicationId,
      oldStatus: `HR: ${oldHrStatus}`,
      newStatus: `HR: ${hrStatus}`,
      changedBy: "HR-CRM",
      note: `HR status changed to ${hrStatus} from HR-CRM`,
    });

    res.status(200).json({ success: true, message: `HR status updated to ${hrStatus}` });
  } catch (error) {
    console.error("Update integration application status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update application status.",
      error: (error as Error).message,
    });
  }
};

// ADMIN CONTROLLERS

export const getAdminApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, jobId, search } = req.query;
    const filter: any = {};

    if (status && status !== "ALL") {
      filter.status = String(status);
    }

    if (jobId && jobId !== "ALL") {
      filter.jobId = jobId;
    }

    const applications = await Application.find(filter)
      .populate("candidateId")
      .populate("jobId")
      .populate("cvAnalysisId")
      .sort({ createdAt: -1 });

    let filtered = applications;

    if (search) {
      const q = String(search).toLowerCase();
      filtered = applications.filter((app: any) => {
        const candidateName = app.candidateId?.name?.toLowerCase() || "";
        const candidateEmail = app.candidateId?.email?.toLowerCase() || "";
        const appId = app.applicationId?.toLowerCase() || "";
        const jobTitle = app.jobId?.title?.toLowerCase() || "";
        return (
          candidateName.includes(q) ||
          candidateEmail.includes(q) ||
          appId.includes(q) ||
          jobTitle.includes(q)
        );
      });
    }

    res.status(200).json({
      success: true,
      count: filtered.length,
      data: filtered,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch admin applications.",
      error: (error as Error).message,
    });
  }
};

export const getAdminApplicationById = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetId = String(req.params.id);
    let application = await Application.findOne({ applicationId: targetId })
      .populate("candidateId")
      .populate("jobId")
      .populate("cvAnalysisId");

    if (!application && targetId.match(/^[0-9a-fA-F]{24}$/)) {
      application = await Application.findById(targetId)
        .populate("candidateId")
        .populate("jobId")
        .populate("cvAnalysisId");
    }

    if (!application) {
      res.status(404).json({ success: false, message: "Application not found." });
      return;
    }

    const events = await ApplicationEvent.find({
      applicationId: application.applicationId,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        application,
        events,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch application.",
      error: (error as Error).message,
    });
  }
};

export const updateAdminApplicationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetId = String(req.params.id);
    const { status, note, changedBy } = req.body;

    let application = await Application.findOne({ applicationId: targetId });
    if (!application && targetId.match(/^[0-9a-fA-F]{24}$/)) {
      application = await Application.findById(targetId);
    }

    if (!application) {
      res.status(404).json({ success: false, message: "Application not found." });
      return;
    }

    const oldStatus = application.status;
    application.status = status;
    await application.save();

    await ApplicationEvent.create({
      applicationId: application.applicationId,
      oldStatus,
      newStatus: status,
      changedBy: changedBy || "Admin",
      note: note || `Status updated to ${status}`,
    });

    res.status(200).json({
      success: true,
      message: `Application status updated to ${status}`,
      data: application,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update application status.",
      error: (error as Error).message,
    });
  }
};
