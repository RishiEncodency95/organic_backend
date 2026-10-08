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

  const count = (where: Record<string, unknown>) => ActivityLog.countDocuments(where);

  const [items, total, statsList, users, modules] = await Promise.all([
    ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ActivityLog.countDocuments(filter),
    // Each count uses an index (createdAt / action / status), so the cards stay fast as the log grows
    Promise.all([
      ActivityLog.estimatedDocumentCount(),
      count({ createdAt: { $gte: today } }),
      count({ action: "Created" }),
      count({ action: "Updated" }),
      count({ action: "Deleted" }),
      count({ action: "Login" }),
      count({ status: "Failed" }),
    ]),
    ActivityLog.distinct("userName"),
    ActivityLog.distinct("module"),
  ]);

  const [all, todayCount, created, updated, deleted, logins, failed] = statsList;
  const stats = { total: all, today: todayCount, created, updated, deleted, logins, failed };

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
