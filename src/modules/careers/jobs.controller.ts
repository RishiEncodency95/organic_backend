import { Request, Response } from "express";
import { createHash } from "crypto";
import Job from "../../models/careers/Job.model";
import Application from "../../models/careers/Application.model";
import { generateJobDescriptionDocx } from "./jobDoc.service";
import { generateJobDescriptionWithAI } from "../../services/ai/jobDescription.service";

const jobContextFingerprint = (job: any): string => {
  const context = {
    title: job.title || "",
    designation: job.designation || "",
    company: job.company || "",
    projectEvent: job.projectEvent || "",
    department: job.department || "",
    jobCode: job.jobCode || "",
    employmentType: job.employmentType || "",
    workplaceType: job.workplaceType || "",
    totalOpenings: job.totalOpenings ?? 1,
    location: job.location || "",
    experienceMin: job.experienceMin ?? 0,
    experienceMax: job.experienceMax ?? 0,
    educationRequirements: job.educationRequirements || "",
    ctcMin: job.ctcMin ?? null,
    ctcMax: job.ctcMax ?? null,
    salaryType: job.salaryType || "",
    performanceIncentiveApplicable: Boolean(job.performanceIncentiveApplicable),
    incentiveType: job.incentiveType || "",
    responsibilities: Array.isArray(job.responsibilities) ? job.responsibilities : [],
    requirements: Array.isArray(job.requirements) ? job.requirements : [],
    skills: Array.isArray(job.skills) ? job.skills : [],
    preferredSkills: Array.isArray(job.preferredSkills) ? job.preferredSkills : [],
    targetIndustrySegments: Array.isArray(job.targetIndustrySegments) ? job.targetIndustrySegments : [],
    specificExperience: job.specificExperience || "",
  };

  return createHash("sha256").update(JSON.stringify(context)).digest("hex");
};

const hasCompleteAiDocumentContext = (job: any): boolean =>
  typeof job.reportingTo === "string" &&
  job.reportingTo.trim().length > 0 &&
  Array.isArray(job.kras) &&
  job.kras.length >= 5 &&
  Array.isArray(job.kpis) &&
  job.kpis.length >= 5 &&
  Array.isArray(job.referenceIndustries) &&
  job.referenceIndustries.length > 0 &&
  Array.isArray(job.screeningQuestions) &&
  job.screeningQuestions.length >= 5;

/**
 * Keeps the DOCX role context tied to the actual saved form values. Existing jobs
 * without a fingerprint are refreshed once; later downloads reuse the saved AI
 * result until a role-defining field changes.
 */
const ensureAiDocumentContext = async (job: any): Promise<void> => {
  const fingerprint = jobContextFingerprint(job);
  if (job.aiContextFingerprint === fingerprint && hasCompleteAiDocumentContext(job)) return;

  try {
    const generated = await generateJobDescriptionWithAI({
      title: job.title,
      designation: job.designation,
      company: job.company,
      projectEvent: job.projectEvent,
      department: job.department,
      jobCode: job.jobCode,
      employmentType: job.employmentType || "Full Time",
      workplaceType: job.workplaceType || "On-site (Office)",
      totalOpenings: job.totalOpenings,
      location: job.location,
      experienceMin: job.experienceMin,
      experienceMax: job.experienceMax,
      educationRequirements: job.educationRequirements,
      ctcMin: job.ctcMin,
      ctcMax: job.ctcMax,
      salaryType: job.salaryType,
      performanceIncentiveApplicable: job.performanceIncentiveApplicable,
      incentiveType: job.incentiveType,
      keyResponsibilities: job.responsibilities,
      requiredSkills: job.skills,
      preferredSkills: job.preferredSkills,
      targetIndustrySegments: job.targetIndustrySegments,
      specificExperience: job.specificExperience,
    });

    job.reportingTo = generated.reportingTo;
    job.kras = generated.kras;
    job.kpis = generated.kpis;
    job.referenceIndustries = generated.referenceIndustries;
    job.screeningQuestions = generated.screeningQuestions;
    job.aiContextFingerprint = fingerprint;
    await job.save();
  } catch (error) {
    // A document can still be produced from the deterministic fallback. Do not
    // store the fingerprint so the next export can retry OpenAI automatically.
    console.warn("OpenAI job-document context generation failed; using fallback:", error instanceof Error ? error.message : error);
  }
};

export const generateJobDescription = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, department, location, employmentType, workplaceType } = req.body || {};
    if (!title || !department || !location) {
      res.status(400).json({ success: false, message: "Job title, department and location are required to generate content." });
      return;
    }

    const generated = await generateJobDescriptionWithAI({
      title,
      designation: req.body.designation,
      company: req.body.company,
      projectEvent: req.body.projectEvent,
      department,
      jobCode: req.body.jobCode,
      employmentType: employmentType || "Full Time",
      workplaceType: workplaceType || "On-site (Office)",
      totalOpenings: req.body.totalOpenings,
      location,
      experienceMin: req.body.experienceMin,
      experienceMax: req.body.experienceMax,
      educationRequirements: req.body.educationRequirements,
      ctcMin: req.body.ctcMin,
      ctcMax: req.body.ctcMax,
      salaryType: req.body.salaryType,
      performanceIncentiveApplicable: req.body.performanceIncentiveApplicable,
      incentiveType: req.body.incentiveType,
    });

    res.status(200).json({ success: true, data: generated });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to generate job description",
    });
  }
};

export const getJobs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, department, location, type } = req.query;
    const query: any = { status: "OPEN" };

    if (search) {
      query.$or = [
        { title: { $regex: String(search), $options: "i" } },
        { department: { $regex: String(search), $options: "i" } },
        { skills: { $in: [new RegExp(String(search), "i")] } },
      ];
    }

    if (department && department !== "All") {
      query.department = String(department);
    }

    if (location && location !== "All") {
      query.location = String(location);
    }

    if (type && type !== "All") {
      query.employmentType = String(type);
    }

    const jobs = await Job.find(query).sort({ publishedAt: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: jobs.length,
      data: jobs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch job listings",
      error: (error as Error).message,
    });
  }
};

export const getJobBySlug = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const targetSlug = String(slug);
    
    // Support matching either slug or MongoDB _id
    let job = await Job.findOne({ slug: targetSlug });
    if (!job && targetSlug.match(/^[0-9a-fA-F]{24}$/)) {
      job = await Job.findById(targetSlug);
    }

    if (!job) {
      res.status(404).json({
        success: false,
        message: "Job position not found",
      });
      return;
    }

    job.views = (job.views || 0) + 1;
    await job.save();

    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch job details",
      error: (error as Error).message,
    });
  }
};

export const exportJobDocx = async (req: Request, res: Response): Promise<void> => {
  try {
    const target = String(req.params.slug);
    let job = await Job.findOne({ slug: target, status: "OPEN" });

    if (!job && /^[0-9a-fA-F]{24}$/.test(target)) {
      job = await Job.findOne({ _id: target, status: "OPEN" });
    }

    if (!job) {
      res.status(404).json({ success: false, message: "Active job position not found" });
      return;
    }

    await ensureAiDocumentContext(job);
    const buffer = await generateJobDescriptionDocx(job);
    const filename = `${job.title.replace(/[^a-zA-Z0-9]+/g, "-").replace(/(^-|-$)+/g, "")}.docx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(buffer);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate job description document",
      error: (error as Error).message,
    });
  }
};

export const getAdminJobsList = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobs = await Job.find({}).sort({ createdAt: -1 }).lean();
    const jobIds = jobs.map((j: any) => j._id);

    const counts = await Application.aggregate([
      { $match: { jobId: { $in: jobIds } } },
      { $group: { _id: "$jobId", count: { $sum: 1 } } },
    ]);
    const countByJobId = new Map(counts.map((c: any) => [String(c._id), c.count]));

    const data = jobs.map((job: any) => ({
      ...job,
      applicationsCount: countByJobId.get(String(job._id)) || 0,
    }));

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch job postings",
      error: (error as Error).message,
    });
  }
};

export const getAdminJobById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);

    if (!job) {
      res.status(404).json({ success: false, message: "Job not found" });
      return;
    }

    res.status(200).json({ success: true, data: job });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch job",
      error: (error as Error).message,
    });
  }
};

export const exportAdminJobDocx = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);

    if (!job) {
      res.status(404).json({ success: false, message: "Job not found" });
      return;
    }

    await ensureAiDocumentContext(job);
    const buffer = await generateJobDescriptionDocx(job);
    const filename = `${job.title.replace(/[^a-zA-Z0-9]+/g, "-").replace(/(^-|-$)+/g, "")}.docx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate job description document",
      error: (error as Error).message,
    });
  }
};

async function uniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
  let slug = baseSlug;
  let suffix = 2;
  while (await Job.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

function describeError(error: unknown): string {
  if (error && typeof error === "object" && "name" in error) {
    const err = error as { name?: string; code?: number; message?: string; errors?: Record<string, { message: string }> };
    if (err.name === "ValidationError" && err.errors) {
      return Object.values(err.errors).map((e) => e.message).join("; ");
    }
    if (err.code === 11000) {
      return "A job with this title/slug already exists.";
    }
  }
  return error instanceof Error ? error.message : "Unknown error";
}

export const createAdminJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobData = req.body;
    const baseSlug = jobData.slug || (jobData.title ? jobData.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") : "");
    jobData.slug = await uniqueSlug(baseSlug);

    const job = await Job.create(jobData);
    res.status(201).json({ success: true, data: job });
  } catch (error) {
    res.status(400).json({ success: false, message: describeError(error), error: describeError(error) });
  }
};

export const updateAdminJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const updateData = { ...req.body };
    if (updateData.title && !updateData.slug) {
      const baseSlug = updateData.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
      updateData.slug = await uniqueSlug(baseSlug, id);
    }

    const updated = await Job.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!updated) {
      res.status(404).json({ success: false, message: "Job not found" });
      return;
    }
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: describeError(error), error: describeError(error) });
  }
};

export const deleteAdminJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await Job.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "Job deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete job", error: (error as Error).message });
  }
};
