import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import Chat from "../../models/chat/Chat.model";
import KnowledgeSource from "../../models/chat/KnowledgeSource.model";
import { Admin } from "../../models/Admin.model";
import asyncHandler from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { ApiResponse } from "../../utils/ApiResponse";
import { env } from "../../config/env";
import {
  CONFIG_SECTIONS,
  askBot,
  clearLiveCache,
  extractFileText,
  extractWebText,
  getConfigDoc,
  getPublicSettings,
  type ConfigSection,
} from "./chatbot.service";

/** Source as the admin panel lists it — the extracted text itself stays on the server */
const sourceView = (s: any) => ({
  _id: s._id,
  name: s.name,
  kind: s.kind,
  url: s.url,
  includeLinked: s.includeLinked,
  frequency: s.frequency,
  topic: s.topic,
  owner: s.owner,
  status: s.status,
  error: s.error,
  checkedAt: s.checkedAt,
  chars: (s.content || "").length,
  pendingChars: s.pendingContent ? s.pendingContent.length : undefined,
  preview: (s.pendingContent || s.content || "").slice(0, 600),
});

const adminName = async (req: Request) => {
  const id = req.user?.id;
  if (!id || !isValidObjectId(id)) return "Admin";
  const admin = await Admin.findById(id).select("name fullName email").lean<any>();
  return admin?.name || admin?.fullName || admin?.email || "Admin";
};

// ─── Manager config (draft / publish) ────────────────────────────────────────

// GET /api/admin/chatbot/manager — draft of every section, versions, AI status
export const getManager = asyncHandler(async (_req: Request, res: Response) => {
  const doc = await getConfigDoc();
  const draft = (doc.draft || {}) as Record<string, unknown>;
  const live = (doc.published || {}) as Record<string, unknown>;
  const sources = await KnowledgeSource.countDocuments({ status: { $ne: "Published" } });
  res.status(200).json(
    ApiResponse.ok("Chatbot manager", {
      draft,
      pending: !!doc.pending || sources > 0,
      versions: versionList(doc.versions),
      // Unpublished edits per area, for the Publish popup
      changes: {
        buttons: changedCount(draft.buttons, live.buttons),
        answers: changedCount(draft.answers, live.answers),
        sources,
        forms: changedCount(draft.forms, live.forms) + changedCount(draft.rules, live.rules),
        settings: changedCount(draft.settings, live.settings),
      },
      ai: { configured: !!env.OPENAI_API_KEY, model: env.OPENAI_MODEL },
    })
  );
});

/** Newest first, without the snapshots */
const versionList = (versions: any[] = []) =>
  [...versions].sort((a, b) => b.minor - a.minor).map((v) => ({ minor: v.minor, note: v.note, by: v.by, date: v.date }));

/** How many items differ between draft and live (lists by id or position, anything else as one) */
const changedCount = (draft: unknown, live: unknown): number => {
  if (draft === undefined) return 0;
  if (Array.isArray(draft) || Array.isArray(live)) {
    const a = Array.isArray(draft) ? draft : [];
    const b = Array.isArray(live) ? live : [];
    const key = (x: any, i: number) => String(x?.id ?? x?._id ?? i);
    const liveById = new Map(b.map((x, i) => [key(x, i), JSON.stringify(x)]));
    const draftIds = new Set(a.map(key));
    const changed = a.filter((x, i) => liveById.get(key(x, i)) !== JSON.stringify(x)).length;
    const removed = b.filter((x, i) => !draftIds.has(key(x, i))).length;
    return changed + removed;
  }
  if (draft && typeof draft === "object" && !Array.isArray(draft)) {
    const d = draft as Record<string, unknown>;
    const l = (live || {}) as Record<string, unknown>;
    return Object.keys(d).filter((k) => JSON.stringify(d[k]) !== JSON.stringify(l[k])).length;
  }
  return JSON.stringify(draft) === JSON.stringify(live) ? 0 : 1;
};

// POST /api/admin/chatbot/manager/restore — { minor }: that version becomes the draft again
export const restoreVersion = asyncHandler(async (req: Request, res: Response) => {
  const doc = await getConfigDoc();
  const version = doc.versions.find((v) => v.minor === Number(req.body.minor));
  if (!version?.snapshot) throw ApiError.badRequest("This version can no longer be restored.");
  doc.draft = JSON.parse(JSON.stringify(version.snapshot));
  doc.markModified("draft");
  doc.pending = true;
  await doc.save();
  res.status(200).json(ApiResponse.ok("Restored to draft", { draft: doc.draft, pending: true }));
});

// PUT /api/admin/chatbot/manager/draft — saves one section of the draft
export const saveDraftSection = asyncHandler(async (req: Request, res: Response) => {
  const section = String(req.body.section) as ConfigSection;
  if (!CONFIG_SECTIONS.includes(section)) throw ApiError.badRequest("Unknown section");
  if (req.body.data === undefined) throw ApiError.badRequest("data is required");
  if (JSON.stringify(req.body.data).length > 500_000) throw ApiError.badRequest("This section is too large");
  const doc = await getConfigDoc();
  doc.set(`draft.${section}`, req.body.data);
  doc.markModified("draft");
  doc.pending = true;
  await doc.save();
  res.status(200).json(ApiResponse.ok("Draft saved", { pending: true }));
});

// POST /api/admin/chatbot/manager/publish — the draft (and draft knowledge) goes live
export const publishManager = asyncHandler(async (req: Request, res: Response) => {
  const note = String(req.body.note || "").trim().slice(0, 300);
  const doc = await getConfigDoc();
  const minor = Math.max(0, ...(doc.versions || []).map((v) => v.minor)) + 1;
  doc.published = JSON.parse(JSON.stringify(doc.draft || {}));
  doc.markModified("published");
  doc.pending = false;
  doc.versions.push({ minor, note: note || "Published changes", by: await adminName(req), date: new Date(), snapshot: doc.published });
  // Older versions stay in the history without their (large) snapshot
  const keep = new Set([...doc.versions].sort((a, b) => b.minor - a.minor).slice(0, 20).map((v) => v.minor));
  doc.versions.forEach((v) => {
    if (!keep.has(v.minor)) v.snapshot = undefined;
  });
  doc.markModified("versions");
  await doc.save();

  // Knowledge goes live with the rest: new sources and reviewed updates
  await KnowledgeSource.updateMany({ status: "Draft" }, { $set: { status: "Published" } });
  const pendingUpdates = await KnowledgeSource.find({ status: "Update pending" });
  for (const s of pendingUpdates) {
    if (s.pendingContent) s.content = s.pendingContent;
    s.pendingContent = undefined;
    s.status = "Published";
    await s.save();
  }
  clearLiveCache();

  res.status(200).json(ApiResponse.ok("Published", { versions: versionList(doc.versions), pending: false }));
});

// ─── Knowledge sources ───────────────────────────────────────────────────────

// GET /api/admin/chatbot/sources
export const listSources = asyncHandler(async (_req: Request, res: Response) => {
  const rows = await KnowledgeSource.find().sort({ createdAt: 1 }).lean();
  res.status(200).json(ApiResponse.ok("Sources", rows.map(sourceView)));
});

/** "Q: …  A: …" text for a manual FAQ source */
const faqText = (body: any) => {
  let phrases: string[] = [];
  try {
    phrases = Array.isArray(body.phrases) ? body.phrases : JSON.parse(body.phrases || "[]");
  } catch {
    phrases = [];
  }
  return [
    `Q: ${String(body.question || "").trim()}`,
    phrases.length ? `Also asked as: ${phrases.join(" | ")}` : "",
    body.answerEn ? `Answer (English): ${String(body.answerEn).trim()}` : "",
    body.answerHi ? `Answer (Hindi): ${String(body.answerHi).trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
};

// POST /api/admin/chatbot/sources — website page, document (multipart "file") or manual text
export const createSource = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body || {};
  const kind = String(body.kind) as "web" | "pdf" | "manual";
  if (!["web", "pdf", "manual"].includes(kind)) throw ApiError.badRequest("Invalid source type");
  const name = String(body.name || "").trim().slice(0, 150);
  if (!name) throw ApiError.badRequest("Source name is required");

  let content = "";
  let url: string | undefined;
  try {
    if (kind === "web") {
      url = String(body.url || "").trim();
      if (!url) throw new Error("Website address is required.");
      content = await extractWebText(url, String(body.includeLinked) === "true");
    } else if (kind === "pdf") {
      const file = req.file;
      if (!file) throw new Error("Please choose a PDF, DOCX or TXT file.");
      content = await extractFileText(file.buffer, file.originalname);
    } else {
      content = body.text ? String(body.text).trim() : faqText(body);
      if (!content.trim()) throw new Error("Please add the text content.");
      content = content.slice(0, 30_000);
    }
  } catch (error: any) {
    throw ApiError.badRequest(error?.message || "Could not read this source.");
  }

  const source = await KnowledgeSource.create({
    name,
    kind,
    url,
    includeLinked: String(body.includeLinked) === "true",
    frequency: body.frequency || "Manually",
    topic: body.topic || "General",
    owner: body.owner,
    status: "Draft",
    content,
    checkedAt: new Date(),
  });
  res.status(201).json(ApiResponse.created("Source added", sourceView(source)));
});

/** Fetches a website source again; a published source keeps its text until the update is reviewed */
const refreshWebSource = async (s: any): Promise<boolean> => {
  try {
    const text = await extractWebText(s.url, s.includeLinked);
    s.error = undefined;
    s.checkedAt = new Date();
    const current = s.pendingContent || s.content;
    if (text === current) {
      await s.save();
      return false;
    }
    if (s.status === "Draft") s.content = text;
    else {
      s.pendingContent = text;
      s.status = "Update pending";
    }
    await s.save();
    return true;
  } catch (error: any) {
    s.error = error?.message || "Could not fetch the page";
    s.checkedAt = new Date();
    await s.save();
    return false;
  }
};

// POST /api/admin/chatbot/sources/check — "Check for Updates" on every website source
export const checkSources = asyncHandler(async (_req: Request, res: Response) => {
  const sources = await KnowledgeSource.find({ kind: "web" });
  let changed = 0;
  for (const s of sources) if (await refreshWebSource(s)) changed += 1;
  clearLiveCache();
  const rows = await KnowledgeSource.find().sort({ createdAt: 1 }).lean();
  res.status(200).json(ApiResponse.ok("Checked", { changed, sources: rows.map(sourceView) }));
});

// POST /api/admin/chatbot/sources/:id/refresh
export const refreshSource = asyncHandler(async (req: Request, res: Response) => {
  const s = await KnowledgeSource.findById(String(req.params.id));
  if (!s) throw ApiError.notFound("Source not found");
  const changed = s.kind === "web" ? await refreshWebSource(s) : false;
  res.status(200).json(ApiResponse.ok("Checked", { changed, source: sourceView(s) }));
});

// PATCH /api/admin/chatbot/sources/:id — approve / keep a pending update, or edit details
export const updateSource = asyncHandler(async (req: Request, res: Response) => {
  const s = await KnowledgeSource.findById(String(req.params.id));
  if (!s) throw ApiError.notFound("Source not found");
  const { action, name, topic, owner } = req.body || {};
  // "approve" needs no change here: an approved update goes live with the next publish.
  // "keep" drops the fetched update and keeps the published text.
  if (action === "keep") {
    s.pendingContent = undefined;
    if (s.status === "Update pending") s.status = "Published";
  }
  if (name) s.name = String(name).trim().slice(0, 150);
  if (topic) s.topic = String(topic).trim();
  if (owner) s.owner = String(owner).trim();
  await s.save();
  clearLiveCache();
  res.status(200).json(ApiResponse.ok("Source updated", sourceView(s)));
});

// DELETE /api/admin/chatbot/sources/:id
export const deleteSource = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!isValidObjectId(id)) throw ApiError.badRequest("Invalid source id");
  await KnowledgeSource.deleteOne({ _id: id });
  clearLiveCache();
  res.status(200).json(ApiResponse.ok("Source deleted", null));
});

// ─── Tests, preview and review queue ─────────────────────────────────────────

// POST /api/admin/chatbot/test — one real reply from the bot, with the live or draft knowledge
export const testBot = asyncHandler(async (req: Request, res: Response) => {
  const question = String(req.body.question || "").trim().slice(0, 1000);
  if (!question) throw ApiError.badRequest("Question is required");
  const mode = req.body.mode === "live" ? "live" : "draft";
  const history = Array.isArray(req.body.history)
    ? req.body.history
        .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
        .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 2000) }))
    : [];
  try {
    const result = await askBot({ question, mode, language: req.body.language, history });
    res.status(200).json(ApiResponse.ok("Reply", result));
  } catch (error: any) {
    throw new ApiError(502, error?.message || "The AI could not reply. Please try again.");
  }
});

// GET /api/admin/chatbot/review — questions the bot could not answer, most asked first
export const getReviewQueue = asyncHandler(async (_req: Request, res: Response) => {
  const doc = await getConfigDoc();
  const dismissed = new Set(doc.dismissedQuestions || []);
  const rows = await Chat.find({ "messages.needsReview": true }).select("messages").sort({ updatedAt: -1 }).limit(500).lean();

  const byQuestion = new Map<string, { question: string; asked: number; visitorMessage: string; botReply: string; lastAskedAt: Date }>();
  for (const chat of rows) {
    const msgs = chat.messages as { role: string; content: string; needsReview?: boolean; createdAt: Date }[];
    msgs.forEach((m, i) => {
      if (m.role !== "assistant" || !m.needsReview) return;
      const asked = [...msgs.slice(0, i)].reverse().find((x) => x.role === "user");
      if (!asked) return;
      const key = asked.content.trim().toLowerCase().replace(/[?.!\s]+$/, "");
      if (!key || dismissed.has(key)) return;
      const prev = byQuestion.get(key);
      byQuestion.set(key, {
        question: prev?.question || asked.content.trim(),
        asked: (prev?.asked || 0) + 1,
        visitorMessage: asked.content,
        botReply: m.content,
        lastAskedAt: prev && prev.lastAskedAt > m.createdAt ? prev.lastAskedAt : m.createdAt,
      });
    });
  }
  const items = [...byQuestion.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.asked - a.asked || +new Date(b.lastAskedAt) - +new Date(a.lastAskedAt))
    .slice(0, 50);
  res.status(200).json(ApiResponse.ok("Review queue", items));
});

// POST /api/admin/chatbot/review/dismiss — { key, undo? }
export const dismissReview = asyncHandler(async (req: Request, res: Response) => {
  const key = String(req.body.key || "").trim().toLowerCase();
  if (!key) throw ApiError.badRequest("key is required");
  const doc = await getConfigDoc();
  const list = new Set(doc.dismissedQuestions || []);
  if (req.body.undo) list.delete(key);
  else list.add(key);
  doc.dismissedQuestions = [...list].slice(-2000);
  await doc.save();
  res.status(200).json(ApiResponse.ok("Saved", null));
});

// ─── Public ──────────────────────────────────────────────────────────────────

// GET /api/chat/config — published name, greetings and on/off for the website chat
export const getPublicChatConfig = asyncHandler(async (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "public, max-age=60");
  res.status(200).json(ApiResponse.ok("Chat config", await getPublicSettings()));
});
