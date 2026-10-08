import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { ActivityLog, ACTIVITY_ACTIONS } from "../../models/ActivityLog.model";

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Start / end of a yyyy-mm-dd day in the server's time zone (end is exclusive). */
const dayStart = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * GET /activity-logs?page&limit&q&user&action&module&status&from&to
 * → { items, total, page, pages, stats, filters }
 * `stats` cover every log (for the cards); `filters` list the values to pick from.
 */
export const listActivityLogs = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(5000, Math.max(1, Number(req.query.limit) || 20));

  const filter: Record<string, unknown> = {};
  const user = str(req.query.user);
  const action = str(req.query.action);
  const module = str(req.query.module);
  const status = str(req.query.status);
  if (user) filter.userName = user;
  if (action && (ACTIVITY_ACTIONS as readonly string[]).includes(action)) filter.action = action;
  if (module) filter.module = module;
  if (status === "Success" || status === "Failed") filter.status = status;

  const from = dayStart(str(req.query.from));
  const to = dayStart(str(req.query.to));
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = from;
    if (to) range.$lt = new Date(to.getTime() + 24 * 60 * 60 * 1000);
    filter.createdAt = range;
  }

  const q = str(req.query.q).slice(0, 100);
  if (q) {
    const re = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ userName: re }, { userEmail: re }, { module: re }, { url: re }, { apiPath: re }, { details: re }, { ip: re }];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [items, total, statsAgg, users, modules] = await Promise.all([
    ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ActivityLog.countDocuments(filter),
    ActivityLog.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          today: { $sum: { $cond: [{ $gte: ["$createdAt", today] }, 1, 0] } },
          created: { $sum: { $cond: [{ $eq: ["$action", "Created"] }, 1, 0] } },
          updated: { $sum: { $cond: [{ $eq: ["$action", "Updated"] }, 1, 0] } },
          deleted: { $sum: { $cond: [{ $eq: ["$action", "Deleted"] }, 1, 0] } },
          logins: { $sum: { $cond: [{ $eq: ["$action", "Login"] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ["$status", "Failed"] }, 1, 0] } },
        },
      },
    ]),
    ActivityLog.distinct("userName"),
    ActivityLog.distinct("module"),
  ]);

  const stats = statsAgg[0] ?? { total: 0, today: 0, created: 0, updated: 0, deleted: 0, logins: 0, failed: 0 };
  delete (stats as { _id?: unknown })._id;

  res.status(200).json(
    new ApiResponse(200, "Activity logs fetched successfully", {
      items,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      stats,
      filters: {
        users: (users as string[]).filter(Boolean).sort((a, b) => a.localeCompare(b)),
        modules: (modules as string[]).filter(Boolean).sort((a, b) => a.localeCompare(b)),
        actions: ACTIVITY_ACTIONS,
      },
    })
  );
});
