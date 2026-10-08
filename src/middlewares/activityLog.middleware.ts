import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { Admin } from "../models/Admin.model";
import { ActivityLog, ActivityAction } from "../models/ActivityLog.model";
import type { JwtPayload } from "./auth.middleware";
import { activityContext, type RecordedChange } from "../config/activityTracker";

/*
 * Activity log: records every write request (POST / PUT / PATCH / DELETE) made with an
 * admin token, after the response is sent, so it never slows down or breaks a request.
 * Website visitors (no admin token) are not logged. Admin logins are logged, failed ones too.
 *
 * The admin panel sends the page it is on (X-Admin-Page) and that page's menu name
 * (X-Admin-Module); without them the module comes from the API path.
 */

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Token housekeeping and the log itself are not admin actions
const SKIP = [/^\/auth\/refresh-token/, /^\/activity-logs/, /^\/auth\/forgot-password/, /^\/auth\/reset-password/];
const LOGIN = /^\/auth\/(login|verify-2fa)$/;

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const NAME_FIELDS = ["title", "name", "label", "fullName", "heading", "question", "companyName", "email", "slug"];

/** Admin names are looked up once per few minutes, not on every request. */
const adminCache = new Map<string, { at: number; admin: { name: string; email?: string; role?: string } | null }>();
const ADMIN_TTL = 5 * 60 * 1000;

const findAdmin = async (id: string) => {
  const hit = adminCache.get(id);
  if (hit && Date.now() - hit.at < ADMIN_TTL) return hit.admin;
  const doc = isValidObjectId(id) ? await Admin.findById(id).select("name email role roleName").lean<any>() : null;
  const admin = doc ? { name: doc.name || doc.email, email: doc.email, role: doc.roleName || doc.role } : null;
  adminCache.set(id, { at: Date.now(), admin });
  return admin;
};

/** The admin id from req.user (protected routes) or from a valid bearer token (open routes). */
const tokenUserId = (req: Request): string | undefined => {
  if (req.user?.id) return req.user.id;
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;
  try {
    return (jwt.verify(header.slice(7), env.ACCESS_TOKEN_SECRET) as JwtPayload).id;
  } catch {
    return undefined;
  }
};

const clip = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

const clientIp = (req: Request) => {
  const ip = (req.ip || req.socket.remoteAddress || "").replace(/^::ffff:/, "");
  return ip === "::1" ? "127.0.0.1" : ip;
};

const titleCase = (text: string) =>
  text
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

/** Path parts that describe the resource (no "admin", ids or version prefixes). */
const resourceParts = (apiPath: string) =>
  apiPath.split("/").filter((p) => p && !OBJECT_ID.test(p) && !/^\d+$/.test(p) && !["admin", "website", "v1", "api"].includes(p));

const moduleFromPath = (apiPath: string) => titleCase(resourceParts(apiPath)[0] || "General");

const actionFor = (method: string, apiPath: string): ActivityAction => {
  const p = apiPath.toLowerCase();
  if (LOGIN.test(p)) return "Login";
  if (p.startsWith("/auth/logout")) return "Logout";
  if (p.startsWith("/auth/change-password")) return "Password Changed";
  if (/\/(upload|uploads)(\/|$)/.test(p) || p.startsWith("/uploads")) return "Uploaded";
  if (/\/publish(\/|$)/.test(p)) return "Published";
  if (/\/restore(\/|$)/.test(p)) return "Restored";
  if (/\/(order|reorder)(\/|$)/.test(p)) return "Reordered";
  if (/\/import(\/|$)/.test(p)) return "Imported";
  if (/\/export(\/|$)/.test(p)) return "Exported";
  if (/\/(send|reply|forward|notify)(\/|$)/.test(p)) return "Sent";
  if (method === "DELETE") return "Deleted";
  if (method === "PUT" || method === "PATCH") return "Updated";
  return "Created";
};

const VERB: Partial<Record<ActivityAction, string>> = {
  Created: "added",
  Updated: "updated",
  Deleted: "deleted",
  Uploaded: "uploaded",
  Published: "published",
  Restored: "restored",
  Reordered: "reordered",
  Imported: "imported",
  Exported: "exported",
  Sent: "sent",
};

/** e.g. `Option "Male" updated`, `Blog #a1b2c3 deleted`, or the server's error message. */
const describe = (action: ActivityAction, apiPath: string, body: any, response: any, ok: boolean, entityId?: string, record?: Record<string, unknown>) => {
  if (!ok) return clip(response?.message, 300) || "Request failed";
  if (action === "Login") return "Signed in to the admin panel";
  if (action === "Logout") return "Signed out";
  if (action === "Password Changed") return "Changed own password";

  const parts = resourceParts(apiPath);
  const last = parts.filter((p) => !["order", "reorder", "publish", "restore", "draft", "status"].includes(p)).pop() || parts[0] || "record";
  const resource = titleCase(last.endsWith("ies") ? `${last.slice(0, -3)}y` : last.replace(/s$/, ""));

  const source = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const data = response?.data && typeof response.data === "object" ? response.data : {};
  // the record itself (old values for a delete) names it when the request does not
  const saved = record ?? {};
  const name = NAME_FIELDS.map((f) => clip(source[f], 60) || clip(data[f], 60) || clip(saved[f], 60)).find(Boolean);

  const verb = VERB[action] ?? action.toLowerCase();
  const id = entityId ? ` (#${entityId.slice(-6)})` : "";
  if (name) return `${resource} "${name}" ${verb}${id}`;
  if (action === "Updated" && typeof source.isActive === "boolean") return `${resource}${id} ${source.isActive ? "shown" : "hidden"}`;
  return `${resource}${id} ${verb}`;
};

/** Adds which fields an update changed, e.g. `Option "Male" updated · label, isActive`. */
const withChangedFields = (details: string, changes: RecordedChange[]) => {
  const fields = [...new Set(changes.filter((c) => c.operation === "updated").flatMap((c) => Object.keys(c.after ?? {})))];
  if (!fields.length) return details;
  return `${details} · ${fields.slice(0, 6).join(", ")}${fields.length > 6 ? ` +${fields.length - 6} more` : ""}`;
};

const record = async (req: Request, res: Response, apiPath: string, response: any, startedAt: number, changes: RecordedChange[]) => {
  const action = actionFor(req.method, apiPath);
  const ok = res.statusCode < 400;

  let userId: string | undefined;
  let user: { name: string; email?: string; role?: string } | null = null;

  if (action === "Login") {
    const admin = response?.data?.admin;
    if (ok && !admin) return; // first step of a 2FA login; logged when the code is verified
    if (admin) {
      userId = String(admin.id ?? admin._id ?? "");
      user = { name: admin.name || admin.email, email: admin.email, role: admin.roleName || admin.role };
    } else {
      const email = clip(req.body?.email, 120);
      if (!email) return;
      user = { name: email, email };
    }
  } else {
    userId = tokenUserId(req);
    if (!userId) return; // a website visitor, not an admin
    user = (await findAdmin(userId)) ?? { name: "Admin" };
  }

  const fromId = apiPath.split("/").reverse().find((p) => OBJECT_ID.test(p));
  const createdId = response?.data && typeof response.data === "object" ? response.data._id ?? response.data.id : undefined;
  const entityId = fromId || (createdId && OBJECT_ID.test(String(createdId)) ? String(createdId) : undefined);

  await ActivityLog.create({
    userId,
    userName: user.name || "Admin",
    userEmail: user.email,
    userRole: user.role,
    action,
    module:
      action === "Login" || action === "Logout" || action === "Password Changed"
        ? "Authentication"
        : clip(req.headers["x-admin-module"], 80) || moduleFromPath(apiPath),
    url: clip(req.headers["x-admin-page"], 300) || apiPath,
    method: req.method,
    apiPath: apiPath.slice(0, 300),
    ip: clientIp(req),
    userAgent: clip(req.headers["user-agent"], 300),
    status: ok ? "Success" : "Failed",
    statusCode: res.statusCode,
    details: withChangedFields(describe(action, apiPath, req.body, response, ok, entityId, changes[0]?.after ?? changes[0]?.before), ok ? changes : []),
    entityId,
    durationMs: Date.now() - startedAt,
    // Old → new values (not for sign-in / sign-out, which only touch the admin's own login data)
    changes: action === "Login" || action === "Logout" ? [] : changes,
  });
};

export const activityLogger = (req: Request, res: Response, next: NextFunction) => {
  if (!WRITE_METHODS.has(req.method)) return next();
  const apiPath = req.originalUrl.split("?")[0].replace(/^\/api(\/v1)?/, "") || "/";
  if (SKIP.some((re) => re.test(apiPath))) return next();

  const startedAt = Date.now();
  let response: unknown;
  const json = res.json.bind(res);
  res.json = (body: unknown) => {
    response = body;
    return json(body);
  };

  // Old → new values are only collected for admin requests (bearer token); website forms skip it
  const context = { changes: [] as RecordedChange[] };
  const tracked = Boolean(req.headers.authorization?.startsWith("Bearer "));

  res.on("finish", () => {
    record(req, res, apiPath, response, startedAt, context.changes).catch((err) => logger.warn(`Activity log not saved: ${err?.message ?? err}`));
  });
  if (tracked) activityContext.run(context, next);
  else next();
};
