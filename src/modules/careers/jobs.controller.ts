import { Request, Response } from "express";
import Job from "../../models/careers/Job.model";
import Application from "../../models/careers/Application.model";
import { generateJobDescriptionDocx } from "./jobDoc.service";

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
