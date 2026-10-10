import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import EnquiryRouting, { ASSIGNMENT_TYPES, ASSIGN_DURING, NONE_AVAILABLE, NO_RESPONSE, REASSIGN_DELAYS, WHEN_UNAVAILABLE } from "../../models/chat/EnquiryRouting.model";
import { Admin } from "../../models/Admin.model";
import asyncHandler from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { ApiResponse } from "../../utils/ApiResponse";
import { openCounts } from "./enquiryRouting.service";

/*
 * Notification Settings (admin): GET / PUT /admin/chats/routing — the assignment rules and
 * team alerts, plus the staff list and each person's open enquiries for the capacity table.
 */

const MAX_RULES = 30;
const MAX_ALERTS = 30;

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const oneOf = <T extends string>(value: unknown, list: readonly T[], fallback: T, field: string): T => {
  if (value === undefined || value === null || value === "") return fallback;
  if (!list.includes(value as T)) throw ApiError.badRequest(`Invalid ${field} "${String(value)}"`);
  return value as T;
};

/** GET /admin/chats/routing */
export const getRoutingSettingsAdmin = asyncHandler(async (_req: Request, res: Response) => {
  const [settings, staff] = await Promise.all([
    EnquiryRouting.findOne({ key: "default" }).lean<any>(),
    Admin.find().select("name isActive").sort({ name: 1 }).lean<{ name?: string; isActive?: boolean }[]>(),
  ]);
  const names = staff.map((s) => s.name).filter((n): n is string => Boolean(n));
  const open = await openCounts(names);
  res.status(200).json(
    ApiResponse.ok("Notification settings", {
      settings,
      staff: staff.filter((s) => s.name).map((s) => ({ name: s.name, active: s.isActive !== false, open: open[s.name as string] || 0 })),
    })
  );
});

/** PUT /admin/chats/routing { rules, unmatched, alerts } */
export const saveRoutingSettings = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body || {};
  if (!Array.isArray(body.rules)) throw ApiError.badRequest("rules must be a list");
  if (body.rules.length > MAX_RULES) throw ApiError.badRequest(`At most ${MAX_RULES} rules`);

  const previous = await EnquiryRouting.findOne({ key: "default" }).select("rules.ruleId rules.lastIndex rules.employees").lean<any>();
  const pointers = new Map<number, { lastIndex: number; employees: string[] }>((previous?.rules || []).map((r: any) => [r.ruleId, r]));

  const seen = new Set<number>();
  const rules = body.rules.map((r: any, i: number) => {
    const ruleId = Number(r?.ruleId ?? r?.id);
    if (!Number.isInteger(ruleId) || ruleId < 1 || seen.has(ruleId)) throw ApiError.badRequest(`Rule ${i + 1} needs a unique id`);
    seen.add(ruleId);
    const topic = text(r.topic, 80);
    if (!topic) throw ApiError.badRequest(`Rule ${i + 1} needs a topic`);
    const team = text(r.team, 80);
    if (!team) throw ApiError.badRequest(`"${topic}" needs a team`);
    const employees = [...new Set((Array.isArray(r.employees) ? r.employees : []).map((e: unknown) => text(e, 80)).filter(Boolean))].slice(0, 50) as string[];
    const maxOpen = Number(r.maxOpen ?? 20);
    if (!Number.isInteger(maxOpen) || maxOpen < 0 || maxOpen > 999) throw ApiError.badRequest(`"${topic}": maximum open enquiries must be 0–999`);
    const type = oneOf(r.type, ASSIGNMENT_TYPES, "Assign in Rotation", "assignment type");
    if (r.active && (type === "Fixed Employee" || type === "Least Busy" || type === "Assign in Rotation") && !employees.length)
      throw ApiError.badRequest(`"${topic}" is active and needs at least one eligible employee`);
    // Keep the rotation where it was while the employee list is unchanged
    const before = pointers.get(ruleId);
    const sameList = before && JSON.stringify(before.employees || []) === JSON.stringify(employees);
    return {
      ruleId,
      topic,
      team,
      type,
      backup: text(r.backup, 80),
      active: Boolean(r.active),
      employees,
      maxOpen,
      during: oneOf(r.during, ASSIGN_DURING, "Any Time", "assignment hours"),
      unavailable: oneOf(r.unavailable, WHEN_UNAVAILABLE, "Use Next Available Employee", "unavailable action"),
      noneAvailable: oneOf(r.noneAvailable, NONE_AVAILABLE, "Queue for Team Lead", "no-employee action"),
      keepOwner: r.keepOwner !== false,
      noResponse: oneOf(r.noResponse, NO_RESPONSE, "Notify Team Lead", "no response action"),
      reassign: Boolean(r.reassign),
      delay: oneOf(r.delay, REASSIGN_DELAYS, "Set delay", "overdue delay"),
      lastIndex: sameList ? before.lastIndex ?? -1 : -1,
    };
  });
  for (const r of rules) if (r.reassign && r.delay === "Set delay") throw ApiError.badRequest(`"${r.topic}": choose the overdue delay or turn reassignment off`);

  const a = body.alerts && typeof body.alerts === "object" ? body.alerts : {};
  const list = (Array.isArray(a.list) ? a.list : []).slice(0, MAX_ALERTS).map((x: any) => ({
    id: Number(x?.id) || 0,
    event: text(x?.event, 80),
    recipient: text(x?.recipient, 80),
    inApp: Boolean(x?.inApp),
    email: Boolean(x?.email),
    timing: text(x?.timing, 40),
    required: Boolean(x?.required),
    // A mandatory alert always stays on
    enabled: Boolean(x?.required) || Boolean(x?.enabled),
  }));
  const strings = (o: unknown) =>
    Object.fromEntries(Object.entries(o && typeof o === "object" ? (o as Record<string, unknown>) : {}).slice(0, 10).map(([k, v]) => [k.slice(0, 30), typeof v === "boolean" ? v : text(v, 60)]));
  const alerts = { list, timing: strings(a.timing), delivery: strings(a.delivery) };

  const id = req.user?.id;
  const admin = id && isValidObjectId(id) ? await Admin.findById(id).select("name email").lean<any>() : null;
  const settings = await EnquiryRouting.findOneAndUpdate(
    { key: "default" },
    { $set: { rules, unmatched: text(body.unmatched, 80) || "General Support", alerts, updatedBy: admin?.name || admin?.email || "Admin" } },
    { upsert: true, new: true }
  ).lean();
  res.status(200).json(ApiResponse.ok("Notification settings saved", settings));
});
