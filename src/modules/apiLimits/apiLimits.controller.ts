import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import asyncHandler from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { ApiResponse } from "../../utils/ApiResponse";
import { Admin } from "../../models/Admin.model";
import { ApiAttempt, ApiBlock, ApiLimitSettings } from "../../models/ApiLimit.model";
import { PROTECTED_APIS, protectedApiByKey } from "./apiLimits.registry";
import { blockEnd, clearApiRuleCache, getApiRules } from "./apiLimits.service";

const HISTORY_DAYS = 30;
const MAX_BLOCKS = 500;

const notLifted = { $or: [{ liftedAt: { $exists: false } }, { liftedAt: null }] };

/**
 * GET /api-limits/admin → { rules, stats, blocks }
 * `rules` is every protected API with its limit and today's numbers; `blocks` lists which
 * IP was blocked on which API (last 30 days, newest first).
 */
export const getApiLimits = asyncHandler(async (_req: Request, res: Response) => {
  const rules = await getApiRules();
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const since = new Date(now.getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000);

  const [attemptsToday, activeByApi, blocks, ips7d] = await Promise.all([
    ApiAttempt.aggregate([{ $match: { createdAt: { $gte: today } } }, { $group: { _id: "$api", n: { $sum: 1 } } }]),
    ApiBlock.aggregate([{ $match: { isBlock: { $ne: false }, blockedUntil: { $gt: now }, ...notLifted } }, { $group: { _id: "$api", n: { $sum: 1 } } }]),
    ApiBlock.find({ isBlock: { $ne: false }, createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(MAX_BLOCKS).lean<any[]>(),
    ApiAttempt.distinct("ip", { createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } }),
  ]);
  const todayBy = new Map(attemptsToday.map((r: any) => [r._id, r.n]));
  const activeBy = new Map(activeByApi.map((r: any) => [r._id, r.n]));

  const ruleRows = PROTECTED_APIS.map((api) => ({
    ...rules.get(api.key)!,
    label: api.label,
    path: api.display,
    defaults: { maxAttempts: api.maxAttempts, blockHours: api.blockHours },
    attemptsToday: todayBy.get(api.key) ?? 0,
    blockedNow: activeBy.get(api.key) ?? 0,
  }));

  const blockRows = blocks.map((b) => {
    const end = blockEnd(b) as Date;
    return {
      id: String(b._id),
      ip: b.ip,
      api: b.api,
      apiLabel: protectedApiByKey(b.api)?.label ?? b.api,
      path: b.path ?? protectedApiByKey(b.api)?.display ?? "",
      attempts: b.attempts ?? 0,
      blockedAt: b.createdAt,
      blockedUntil: b.blockedUntil,
      status: b.liftedAt && b.liftedAt < b.blockedUntil ? "Unblocked" : end > now ? "Blocked" : "Expired",
      liftedAt: b.liftedAt ?? null,
      liftedBy: b.liftedBy ?? null,
    };
  });

  res.status(200).json(
    new ApiResponse(200, "IP block limits fetched successfully", {
      rules: ruleRows,
      stats: {
        blockedNow: blockRows.filter((b) => b.status === "Blocked").length,
        blocks30d: blockRows.length,
        attemptsToday: ruleRows.reduce((n, r) => n + r.attemptsToday, 0),
        ips7d: ips7d.length,
        protectedOn: ruleRows.filter((r) => r.enabled).length,
        protectedTotal: ruleRows.length,
      },
      blocks: blockRows,
    })
  );
});

/** PUT /api-limits/admin { rules: [{ key, enabled, maxAttempts, blockHours }] } */
export const updateApiLimits = asyncHandler(async (req: Request, res: Response) => {
  const incoming = req.body?.rules;
  if (!Array.isArray(incoming)) throw new ApiError(400, "rules must be a list");

  const current = await getApiRules();
  for (const r of incoming) {
    const api = protectedApiByKey(String(r?.key));
    if (!api) throw new ApiError(400, `Unknown API "${String(r?.key)}"`);
    const rule = { ...current.get(api.key)! };
    if (r.enabled !== undefined) rule.enabled = Boolean(r.enabled);
    if (r.maxAttempts !== undefined) {
      const n = Number(r.maxAttempts);
      if (!Number.isInteger(n) || n < 1 || n > 1000) throw new ApiError(400, `${api.label}: attempts must be a whole number from 1 to 1000.`);
      rule.maxAttempts = n;
    }
    if (r.blockHours !== undefined) {
      const h = Number(r.blockHours);
      if (!Number.isInteger(h) || h < 1 || h > 720) throw new ApiError(400, `${api.label}: block time must be 1 to 720 hours.`);
      rule.blockHours = h;
    }
    current.set(api.key, rule);
  }

  await ApiLimitSettings.updateOne(
    { key: "default" },
    { $set: { rules: [...current.values()].map(({ key, enabled, maxAttempts, blockHours }) => ({ key, enabled, maxAttempts, blockHours })) } },
    { upsert: true }
  );
  clearApiRuleCache();
  res.status(200).json(new ApiResponse(200, "IP block limits saved", [...(await getApiRules()).values()]));
});

/**
 * POST /api-limits/admin/unblock { ip, api? }
 * Lifts the IP's block on that API (or on every API when `api` is left out) and starts its
 * count again from zero.
 */
export const unblockIp = asyncHandler(async (req: Request, res: Response) => {
  const ip = typeof req.body?.ip === "string" ? req.body.ip.trim() : "";
  if (!ip || ip.length > 64) throw new ApiError(400, "IP address is required");
  const apiKey = typeof req.body?.api === "string" && req.body.api ? req.body.api : null;
  if (apiKey && !protectedApiByKey(apiKey)) throw new ApiError(400, `Unknown API "${apiKey}"`);
  const keys = apiKey ? [apiKey] : PROTECTED_APIS.map((a) => a.key);

  const id = req.user?.id;
  const admin = id && isValidObjectId(id) ? await Admin.findById(id).select("name email").lean<any>() : null;
  const by = admin?.name || admin?.email || "Admin";
  const now = new Date();

  const lifted = await ApiBlock.updateMany(
    { ip, api: { $in: keys }, isBlock: { $ne: false }, blockedUntil: { $gt: now }, ...notLifted },
    { $set: { liftedAt: now, liftedBy: by } }
  );
  // Zero-length rows mark where each API's count starts again
  await ApiBlock.insertMany(keys.map((api) => ({ ip, api, blockedUntil: now, attempts: 0, isBlock: false, liftedAt: now, liftedBy: by })));

  res.status(200).json(
    new ApiResponse(200, lifted.modifiedCount ? `${ip} is unblocked.` : `${ip}'s attempt count was reset.`, { unblocked: lifted.modifiedCount })
  );
});
