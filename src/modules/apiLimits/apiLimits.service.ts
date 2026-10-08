import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { ApiAttempt, ApiBlock, ApiLimitSettings } from "../../models/ApiLimit.model";
import { clientIp } from "../../utils/clientIp";
import { findProtectedApi, PROTECTED_APIS, type ProtectedApi } from "./apiLimits.registry";

export interface ApiRule {
  key: string;
  enabled: boolean;
  maxAttempts: number;
  blockHours: number;
}

const HOUR = 60 * 60 * 1000;

// Rules are read on every protected request; a short cache keeps that off the database
let cache: { at: number; rules: Map<string, ApiRule> } | null = null;
const CACHE_MS = 15 * 1000;
export const clearApiRuleCache = () => {
  cache = null;
};

/** Every protected API's rule: the admin's saved values over the registry defaults. */
export const getApiRules = async (): Promise<Map<string, ApiRule>> => {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rules;
  const doc = await ApiLimitSettings.findOne({ key: "default" }).lean<any>();
  const saved = new Map<string, any>((doc?.rules ?? []).map((r: any) => [r.key, r]));
  const rules = new Map<string, ApiRule>(
    PROTECTED_APIS.map((api) => {
      const s = saved.get(api.key) ?? {};
      return [
        api.key,
        {
          key: api.key,
          enabled: s.enabled ?? true,
          maxAttempts: s.maxAttempts ?? api.maxAttempts,
          blockHours: s.blockHours ?? api.blockHours,
        },
      ];
    })
  );
  cache = { at: Date.now(), rules };
  return rules;
};

/** When a block stops counting: its end, or earlier if an admin lifted it. */
export const blockEnd = (block: { blockedUntil: Date; liftedAt?: Date | null }) =>
  block.liftedAt && block.liftedAt < block.blockedUntil ? block.liftedAt : block.blockedUntil;

/**
 * Where an IP stands on one API: an active block, or the attempts used in the current
 * window (the last `blockHours`, starting again after its last block / unblock).
 */
export const ipApiStatus = async (ip: string, rule: ApiRule, now = new Date()) => {
  const last = await ApiBlock.findOne({ ip, api: rule.key }).sort({ createdAt: -1 }).lean<any>();
  if (last && blockEnd(last) > now) return { blockedUntil: blockEnd(last) as Date, used: last.attempts ?? rule.maxAttempts };

  const windowStart = new Date(now.getTime() - rule.blockHours * HOUR);
  const since = last && blockEnd(last) > windowStart ? (blockEnd(last) as Date) : windowStart;
  const used = await ApiAttempt.countDocuments({ ip, api: rule.key, createdAt: { $gt: since } });
  return { blockedUntil: null as Date | null, used };
};

/** Admins testing the website forms are never blocked. */
const isAdmin = (req: Request) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return false;
  try {
    jwt.verify(header.slice(7), env.ACCESS_TOKEN_SECRET);
    return true;
  } catch {
    return false;
  }
};

const blockedResponse = (res: Response, api: ProtectedApi, rule: ApiRule, blockedUntil: Date) => {
  const hours = Math.max(1, Math.ceil((blockedUntil.getTime() - Date.now()) / HOUR));
  res.status(429).json({
    success: false,
    code: "API_BLOCKED",
    api: api.key,
    message: `Too many attempts. ${api.label} is blocked for your network for the next ${hours} hour${hours === 1 ? "" : "s"}. Please try again later.`,
    retryAt: blockedUntil.toISOString(),
    maxAttempts: rule.maxAttempts,
  });
};

/**
 * Mounted on /api before the routes (and before any file upload is read). For a protected
 * API it turns a blocked IP away, starts the block when the limit is reached, and counts
 * the request once it is accepted (status below 400).
 */
export const apiBlockGuard = async (req: Request, res: Response, next: NextFunction) => {
  const apiPath = req.originalUrl.split("?")[0].replace(/^\/api(\/v1)?/, "") || "/";
  const api = findProtectedApi(req.method, apiPath);
  if (!api || isAdmin(req)) return next();

  try {
    const rule = (await getApiRules()).get(api.key);
    if (!rule?.enabled) return next();

    const ip = clientIp(req);
    const status = await ipApiStatus(ip, rule);
    let blockedUntil = status.blockedUntil;

    if (!blockedUntil && status.used >= rule.maxAttempts) {
      blockedUntil = new Date(Date.now() + rule.blockHours * HOUR);
      await ApiBlock.create({ ip, api: api.key, path: apiPath.slice(0, 200), blockedUntil, attempts: status.used });
    }
    if (blockedUntil) return blockedResponse(res, api, rule, blockedUntil);

    res.on("finish", () => {
      if (res.statusCode < 400) ApiAttempt.create({ ip, api: api.key }).catch(() => {});
    });
    next();
  } catch (error) {
    // Never stop a visitor because the check itself failed
    console.warn("IP block check failed:", (error as Error).message);
    next();
  }
};
