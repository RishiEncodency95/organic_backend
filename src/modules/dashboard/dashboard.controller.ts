import { Request, Response } from "express";
import {
  buildDashboardOverview,
  getIndexCoverageSnapshot,
  getPageSpeedSnapshot,
  getSiteStatusSnapshot,
  parseDashboardRange,
  recordPageViewEvent,
} from "./dashboard.service";

export const dashboardController = {
  async getOverview(req: Request, res: Response) {
    try {
      const range = parseDashboardRange(req.query.range);
      const refresh = req.query.refresh === "1" || req.query.refresh === "true";
      const overviewData = await buildDashboardOverview(range, { forceRefresh: refresh });
      return res.status(200).json({ success: true, data: overviewData });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch dashboard overview",
      });
    }
  },

  async getPageSpeed(req: Request, res: Response) {
    const refresh = req.query.refresh === "1" || req.query.refresh === "true";
    const data = await getPageSpeedSnapshot(refresh);
    return res.status(200).json({ success: true, data });
  },

  async getIndexCoverage(req: Request, res: Response) {
    const refresh = req.query.refresh === "1" || req.query.refresh === "true";
    const data = getIndexCoverageSnapshot(refresh);
    return res.status(200).json({ success: true, data });
  },

  async getSiteStatus(req: Request, res: Response) {
    const refresh = req.query.refresh === "1" || req.query.refresh === "true";
    const data = getSiteStatusSnapshot(refresh);
    return res.status(200).json({ success: true, data });
  },

  async trackPageView(req: Request, res: Response) {
    try {
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }
      await recordPageViewEvent(body && typeof body === "object" ? body : {}, {
        userAgent: req.get("user-agent"),
        country: req.get("cf-ipcountry") || undefined,
        city: req.get("cf-ipcity") || undefined,
      });
    } catch {
      // Beacons must not fail website requests
    }
    return res.status(200).json({ ok: true });
  },
};
