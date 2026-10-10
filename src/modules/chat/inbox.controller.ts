import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { isValidObjectId } from "mongoose";
import Chat, { INBOX_CATEGORIES, INBOX_PRIORITIES, INBOX_STATUSES } from "../../models/chat/Chat.model";
import { Admin } from "../../models/Admin.model";
import asyncHandler from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { ApiResponse } from "../../utils/ApiResponse";
import { notifyAssignment, routeEnquiry } from "./enquiryRouting.service";

/*
 * Inbox & Leads (admin chatbot/inbox): the team's follow-up on each chat — owner, status,
 * priority, next follow-up, spam and the activity history — plus enquiries added by hand.
 */

const MAX_ITEMS = 500;
const MAX_ACTIVITY = 200;
const FOLLOW_UP_KINDS = ["date", "review", "assign", "none"];
const ACTIVITY_KINDS = ["reply", "note", "event"];

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const oneOf = <T extends string>(value: unknown, list: readonly T[], field: string): T | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  if (!list.includes(value as T)) throw ApiError.badRequest(`Invalid ${field} "${String(value)}"`);
  return value as T;
};
const date = (value: unknown, field: string) => {
  if (value === undefined || value === null || value === "") return undefined;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw ApiError.badRequest(`Invalid ${field}`);
  return d;
};

const adminName = async (req: Request) => {
  const id = req.user?.id;
  const admin = id && isValidObjectId(id) ? await Admin.findById(id).select("name email").lean<any>() : null;
  return admin?.name || admin?.email || "Admin";
};

type ActivityIn = { kind?: unknown; text?: unknown; by?: unknown; at?: unknown };

/** The workflow fields from the request body, checked. Missing fields are left as they are. */
const toWorkflow = (body: any, by: string) => {
  const wf: Record<string, unknown> = {};
  if (body.assignedTo !== undefined) wf.assignedTo = text(body.assignedTo, 80) || "Unassigned";
  if (body.team !== undefined) wf.team = text(body.team, 80);
  const status = oneOf(body.status, INBOX_STATUSES, "status");
  if (status) {
    wf.status = status;
    wf.resolvedAt = status === "Resolved" ? date(body.resolvedAt, "resolvedAt") ?? new Date() : null;
  }
  const priority = oneOf(body.priority, INBOX_PRIORITIES, "priority");
  if (priority) wf.priority = priority;
  const kind = oneOf(body.followUpKind, FOLLOW_UP_KINDS, "follow-up");
  if (kind) {
    wf.followUpKind = kind;
    wf.followUpAt = kind === "date" ? date(body.followUpAt, "follow-up date") ?? null : null;
  }
  if (body.spam !== undefined) wf.spam = Boolean(body.spam);
  if (body.seenAt !== undefined) wf.seenAt = date(body.seenAt, "seenAt") ?? null;
  if (Array.isArray(body.activity)) {
    wf.activity = (body.activity as ActivityIn[])
      .filter((a) => ACTIVITY_KINDS.includes(String(a?.kind)) && text(a?.text, 4000))
      .slice(-MAX_ACTIVITY)
      .map((a) => ({ kind: a.kind, text: text(a.text, 4000), by: text(a.by, 80) || by, at: date(a.at, "activity time") ?? new Date() }));
  }
  wf.updatedAt = new Date();
  wf.updatedBy = by;
  return wf;
};

/**
 * PUT /admin/chats/workflow { items: [{ id, assignedTo?, team?, status?, priority?, followUpKind?,
 * followUpAt?, spam?, seenAt?, activity? }] } — saves the inbox state of up to 500 records.
 * The chat's own updatedAt (last visitor activity) is left alone.
 */
export const saveInboxWorkflow = asyncHandler(async (req: Request, res: Response) => {
  const items = req.body?.items;
  if (!Array.isArray(items) || !items.length) throw ApiError.badRequest("items must be a non-empty list");
  if (items.length > MAX_ITEMS) throw ApiError.badRequest(`At most ${MAX_ITEMS} records at a time`);
  const by = await adminName(req);

  const ops = items.map((item: any) => {
    if (!isValidObjectId(item?.id)) throw ApiError.badRequest("Every item needs a valid id");
    const wf = toWorkflow(item, by);
    const $set: Record<string, unknown> = {};
    const $unset: Record<string, ""> = {};
    for (const [k, v] of Object.entries(wf)) {
      if (v === null) $unset[`workflow.${k}`] = "";
      else $set[`workflow.${k}`] = v;
    }
    return { updateOne: { filter: { _id: item.id }, update: { $set, ...(Object.keys($unset).length ? { $unset } : {}) }, timestamps: false } };
  });

  const result = await Chat.bulkWrite(ops as any);
  res.status(200).json(ApiResponse.ok("Inbox saved", { matched: result.matchedCount, modified: result.modifiedCount }));
});

/**
 * POST /admin/chats/manual — an enquiry the team received outside the website chat
 * (phone call, WhatsApp, walk-in…). Saved like a chat so it lives in the same inbox.
 */
export const createManualEnquiry = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body || {};
  const name = text(body.name, 80);
  if (!name) throw ApiError.badRequest("Name is required");
  const mobile = text(body.mobile, 20).replace(/\D/g, "").slice(-10);
  if (mobile && mobile.length !== 10) throw ApiError.badRequest("Mobile number must have 10 digits");
  const email = text(body.email, 120).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw ApiError.badRequest("Invalid email address");
  const category = oneOf(body.category, INBOX_CATEGORIES, "category") ?? "enquiry";
  const by = await adminName(req);

  // No owner chosen: Notification Settings (once saved) pick the team and employee
  const chosen = text(body.assignedTo, 80);
  const topic = text(body.topic, 80);
  const routed =
    !chosen || chosen === "Unassigned"
      ? await routeEnquiry({ text: `${topic} ${text(body.type, 40)} ${category === "complaint" ? "complaint" : ""}`, phone: mobile || undefined })
      : null;
  const assignedTo = chosen && chosen !== "Unassigned" ? chosen : routed?.owner || "Unassigned";
  const followUpAt = date(body.followUpAt, "follow-up date");
  const chat = await Chat.create({
    sessionId: `manual-${randomUUID()}`,
    source: "manual",
    lead: { name, ...(mobile ? { phone: mobile } : {}), ...(email ? { email } : {}) },
    visitorName: name,
    manual: {
      channel: text(body.source, 40) || "Phone call",
      category,
      type: text(body.type, 40),
      topic: text(body.topic, 80),
      detail: text(body.detail, 1000),
    },
    workflow: {
      assignedTo,
      team: text(body.team, 80) || routed?.team || undefined,
      rule: routed?.rule,
      status: assignedTo === "Unassigned" ? "New" : "Assigned",
      priority: oneOf(body.priority, INBOX_PRIORITIES, "priority") ?? "Medium",
      followUpKind: followUpAt ? "date" : assignedTo === "Unassigned" ? "assign" : "review",
      followUpAt,
      updatedAt: new Date(),
      updatedBy: by,
      activity: [
        { kind: "event", text: `Created manually from ${text(body.source, 40) || "Phone call"}`, by, at: new Date() },
        ...(routed && routed.owner !== "Unassigned" ? [{ kind: "event", text: `Assigned to ${routed.owner} (${routed.note})`, by: "Notification Settings", at: new Date() }] : []),
      ],
    },
  });
  if (routed && routed.owner !== "Unassigned") notifyAssignment(routed.owner, { name, phone: mobile, topic: routed.rule || topic || "Enquiry" }, { _id: chat._id }).catch(() => {});

  res.status(201).json(ApiResponse.created("Enquiry created", { id: String(chat._id), createdAt: chat.createdAt }));
});
