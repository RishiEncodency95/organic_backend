import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import CareerEvent, { CAREER_EVENT_TYPES, type CareerEventType } from "../../models/careers/CareerEvent.model";
import Job from "../../models/careers/Job.model";
import CandidateProfile from "../../models/careers/CandidateProfile.model";
import CvAnalysis from "../../models/careers/CvAnalysis.model";
import Application from "../../models/careers/Application.model";
import { clientIp } from "../../utils/clientIp";

/*
 * Careers Dashboard (admin). Page views, job views and apply clicks come from the website
 * (POST /careers/track); CV uploads, AI screening and applications from their own records.
 * AI result bands match Applications & AI Response: Eligible >= 60, Partial Match 50-59.
 */

const DAY = 24 * 60 * 60 * 1000;
const DEDUPE_MS = 30 * 60 * 1000;
const SUBMITTED_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "INTERVIEW", "SELECTED", "REJECTED"];
const RANGES: Record<string, number | null> = { "7d": 7, "30d": 30, "90d": 90, "180d": 180, "365d": 365, all: null };

/** POST /careers/track { type, jobId? } — called by the website's careers page */
export const trackCareerEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const type = String(req.body?.type || "") as CareerEventType;
    if (!CAREER_EVENT_TYPES.includes(type)) {
      res.status(400).json({ success: false, message: "Unknown event type" });
      return;
    }
    const jobId = isValidObjectId(req.body?.jobId) ? String(req.body.jobId) : undefined;
    const ip = clientIp(req);
    const recent = await CareerEvent.exists({ ip, type, jobId: jobId ?? null, createdAt: { $gte: new Date(Date.now() - DEDUPE_MS) } });
    if (!recent) await CareerEvent.create({ type, jobId, ip });
    res.status(200).json({ success: true });
  } catch {
    // Tracking never breaks the careers page
    res.status(200).json({ success: false });
  }
};

const resultFor = (score: number) => (score >= 60 ? "Eligible" : score >= 50 ? "Partial Match" : "Not Eligible");
const pctChange = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 100) : now ? null : 0);

type Bucket = { key: string; label: string; start: Date; end: Date };

/** Chart buckets: last 6 months, 8 weeks or 14 days, oldest first */
const buckets = (granularity: string, now: Date): Bucket[] => {
  const out: Bucket[] = [];
  if (granularity === "daily") {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let i = 13; i >= 0; i--) {
      const start = new Date(today.getTime() - i * DAY);
      out.push({ key: start.toISOString().slice(0, 10), label: start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), start, end: new Date(start.getTime() + DAY) });
    }
  } else if (granularity === "weekly") {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monday = new Date(today.getTime() - ((today.getDay() + 6) % 7) * DAY);
    for (let i = 7; i >= 0; i--) {
      const start = new Date(monday.getTime() - i * 7 * DAY);
      out.push({ key: start.toISOString().slice(0, 10), label: `${start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`, start, end: new Date(start.getTime() + 7 * DAY) });
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({ key: start.toISOString().slice(0, 7), label: start.toLocaleDateString("en-GB", { month: "short", year: "numeric" }), start, end: new Date(now.getFullYear(), now.getMonth() - i + 1, 1) });
    }
  }
  return out;
};

/** GET /careers/admin/dashboard?range=30d&chart=monthly */
export const getCareerDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const rangeKey = String(req.query.range || "30d") in RANGES ? String(req.query.range || "30d") : "30d";
    const days = RANGES[rangeKey];
    const from = days ? new Date(now.getTime() - days * DAY) : new Date(0);
    const prevFrom = days ? new Date(from.getTime() - days * DAY) : null;
    const inRange = { $gte: from, $lte: now };
    const inPrev = prevFrom ? { $gte: prevFrom, $lt: from } : null;
    const granularity = ["daily", "weekly", "monthly"].includes(String(req.query.chart)) ? String(req.query.chart) : "monthly";

    // Counts for the cards, this period and the one before (for the trend arrows)
    const counts = async (when: Record<string, Date>) => {
      const [pageViews, jobViews, applyClicks, cvUploads, analyses, submitted] = await Promise.all([
        CareerEvent.countDocuments({ type: "page_view", createdAt: when }),
        CareerEvent.countDocuments({ type: "job_view", createdAt: when }),
        CareerEvent.countDocuments({ type: "apply_click", createdAt: when }),
        CandidateProfile.countDocuments({ createdAt: when }),
        CvAnalysis.find({ status: "COMPLETED", createdAt: when }).select("matchScore").lean<{ matchScore?: number }[]>(),
        Application.countDocuments({ status: { $in: SUBMITTED_STATUSES }, $or: [{ submittedAt: when }, { submittedAt: null, updatedAt: when }] }),
      ]);
      const tally = { Eligible: 0, "Partial Match": 0, "Not Eligible": 0 } as Record<string, number>;
      for (const a of analyses) tally[resultFor(a.matchScore || 0)]++;
      return {
        pageViews,
        jobViews,
        applyClicks,
        cvUploads,
        aiChecked: analyses.length,
        eligible: tally.Eligible,
        partial: tally["Partial Match"],
        notEligible: tally["Not Eligible"],
        submitted,
      };
    };
    const [current, previous, activeJobs] = await Promise.all([counts(inRange), inPrev ? counts(inPrev) : null, Job.countDocuments({ status: "OPEN" })]);
    const trends = Object.fromEntries(Object.entries(current).map(([k, v]) => [k, previous ? pctChange(v, previous[k as keyof typeof previous]) : null]));

    // Chart series
    const series = await Promise.all(
      buckets(granularity, now).map(async (b) => {
        const when = { $gte: b.start, $lt: b.end };
        const [pageViews, applyClicks, cvUploads] = await Promise.all([
          CareerEvent.countDocuments({ type: "page_view", createdAt: when }),
          CareerEvent.countDocuments({ type: "apply_click", createdAt: when }),
          CandidateProfile.countDocuments({ createdAt: when }),
        ]);
        return { label: b.label, pageViews, applyClicks, cvUploads };
      })
    );

    // Top job locations by submitted applications in the period
    const byLocation = await Application.aggregate([
      // Same "submitted in the period" rule as the Applications card
      { $match: { status: { $in: SUBMITTED_STATUSES }, $or: [{ submittedAt: inRange }, { submittedAt: null, updatedAt: inRange }] } },
      { $lookup: { from: Job.collection.name, localField: "jobId", foreignField: "_id", as: "job" } },
      { $unwind: "$job" },
      { $group: { _id: "$job.location", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const topLocations = byLocation.slice(0, 4).map((l: any) => ({ city: l._id || "Not set", count: l.count }));
    const others = byLocation.slice(4).reduce((n: number, l: any) => n + l.count, 0);
    if (others) topLocations.push({ city: "Others", count: others });

    // Latest applications (any that reached the AI check)
    const latest = await Application.find({ status: { $ne: "DRAFT" } })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate("candidateId", "name")
      .populate("jobId", "title")
      .populate("cvAnalysisId", "matchScore")
      .lean<any[]>();
    const latestApplications = latest.map((a) => {
      const score = Math.round(a.cvAnalysisId?.matchScore ?? a.scoreSnapshot?.matchScore ?? 0);
      return {
        id: String(a._id),
        applicationId: a.applicationId,
        name: a.candidateId?.name || a.candidateSnapshot?.name || "Candidate",
        position: a.jobId?.title || "—",
        appliedOn: a.submittedAt || a.updatedAt,
        matchScore: score,
        result: resultFor(score),
        status: SUBMITTED_STATUSES.includes(a.status) ? "Completed" : "Not Applied",
        source: "Website",
      };
    });

    res.status(200).json({
      success: true,
      data: { range: rangeKey, from: days ? from : null, to: now, granularity, activeJobs, current, trends, series, topLocations, latestApplications },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load the careers dashboard.", error: (error as Error).message });
  }
};
