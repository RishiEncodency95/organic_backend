import { Request, Response } from "express";
import OpenAI from "openai";
import { isValidObjectId } from "mongoose";
import Chat from "../../models/chat/Chat.model";
import ContactEnquiry from "../../models/contact/contactEnquiry.model";
import asyncHandler from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { ApiResponse } from "../../utils/ApiResponse";
import { logger } from "../../utils/logger";
import { env } from "../../config/env";
import { sendWhatsAppTemplate } from "../../services/whatsapp.service";
import { buildInstructions, FALLBACK_REPLY } from "./chat.prompt";
import { toTenDigitMobile } from "./chat.schema";

const HISTORY_LIMIT = 10;
const WHATSAPP_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DUPLICATE_ENQUIRY_MS = 24 * 60 * 60 * 1000;
const CHATBOT_SERVICE = "Chatbot (Organic Mitra)";
const NO_QUESTION_PREFIX = "Started a chat with Organic Mitra on";

let openai: OpenAI | null = null;
const getOpenAI = (): OpenAI | null => {
  if (!env.OPENAI_API_KEY) return null;
  if (!openai) openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return openai;
};

/** Digits only; a leading 91 on a 12-digit Indian number is dropped so duplicates match. */
/**
 * Thank-you WhatsApp to the visitor plus an enquiry copy to the admin number.
 * At most once per phone number per 24 hours, so the form can't be used to spam someone.
 */
const notifyOnWhatsApp = async (sessionId: string, lead: { name: string; phone: string }, pageUrl: string) => {
  const recentlySent = await Chat.exists({
    "lead.phone": lead.phone,
    whatsappSentAt: { $gte: new Date(Date.now() - WHATSAPP_COOLDOWN_MS) },
  });
  if (recentlySent) return;

  const userCampaign = process.env.AISENSY_CAMPAIGN_CHAT_USER;
  const adminCampaign = process.env.AISENSY_CAMPAIGN_CHAT_ADMIN;
  const adminNumber = process.env.ADMIN_WHATSAPP_NUMBER;

  const [userSent] = await Promise.all([
    userCampaign
      ? sendWhatsAppTemplate({
          campaignName: userCampaign,
          phone: lead.phone,
          userName: lead.name,
          templateParams: [lead.name],
          source: "website-chatbot",
        })
      : Promise.resolve(false),
    adminCampaign && adminNumber
      ? sendWhatsAppTemplate({
          campaignName: adminCampaign,
          phone: adminNumber,
          userName: "Admin",
          templateParams: [lead.name, lead.phone, pageUrl || "Website"],
          source: "website-chatbot-admin",
        })
      : Promise.resolve(false),
  ]);

  if (userSent) {
    await Chat.updateOne({ sessionId }, { $set: { whatsappSentAt: new Date() } });
  }
};

// POST /api/chat/lead — visitor details collected before the chat starts
export const startChat = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = String(req.body.sessionId).trim();
  const pageUrl = String(req.body.pageUrl || "").slice(0, 500);
  const lead = {
    name: String(req.body.name).trim().replace(/\s+/g, " "),
    phone: toTenDigitMobile(String(req.body.phone)),
  };

  const existing = await Chat.findOne({ sessionId }).select("enquiryId").lean();

  // Shows up in the admin panel's Contact Enquiries list. The same phone number within
  // 24 hours (e.g. a new chat after the old one expired) reuses its enquiry instead of a duplicate.
  let enquiryId = existing?.enquiryId;
  if (!enquiryId) {
    const recent = await ContactEnquiry.findOne({
      phone: lead.phone,
      service: CHATBOT_SERVICE,
      createdAt: { $gte: new Date(Date.now() - DUPLICATE_ENQUIRY_MS) },
    })
      .sort({ createdAt: -1 })
      .select("_id")
      .lean();
    enquiryId = recent?._id;
  }
  if (!enquiryId) {
    const enquiry = await ContactEnquiry.create({
      ...lead,
      subject: "Chatbot enquiry",
      service: CHATBOT_SERVICE,
      message: `${NO_QUESTION_PREFIX} ${pageUrl || "the website"}.`,
    });
    enquiryId = enquiry._id;
  }

  await Chat.updateOne(
    { sessionId },
    { $set: { lead, pageUrl, enquiryId } },
    { upsert: true }
  );

  notifyOnWhatsApp(sessionId, lead, pageUrl).catch((error) =>
    logger.warn(`Chatbot WhatsApp notification failed: ${error?.message}`)
  );

  res.status(201).json(ApiResponse.created("Chat started", { sessionId }));
});

// POST /api/chat — streams the assistant reply as Server-Sent Events
export const sendChatMessage = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = String(req.body.sessionId).trim();
  const message = String(req.body.message).trim().slice(0, 1000);
  const pageUrl = req.body.pageUrl ? String(req.body.pageUrl).slice(0, 500) : undefined;

  const chat = await Chat.findOne({ sessionId })
    .select({ lead: 1, enquiryId: 1, messages: { $slice: -HISTORY_LIMIT } })
    .lean();
  if (!chat?.lead?.name) {
    throw ApiError.badRequest("Please share your name and mobile number first.");
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (data: Record<string, unknown>) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Stop paying for tokens nobody will read
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  let reply = "";
  try {
    const client = getOpenAI();
    if (!client) throw new Error("OPENAI_API_KEY is not configured");

    const model = env.OPENAI_MODEL;
    const stream = await client.responses.create(
      {
        model,
        instructions: buildInstructions(chat.lead.name),
        input: [
          ...(chat.messages || []).map((m) => ({ role: m.role, content: m.content })),
          { role: "user" as const, content: message },
        ],
        max_output_tokens: 800,
        // Reasoning models spend output tokens on thinking; keep it light for short FAQ answers.
        ...(/^(gpt-5|o\d)/.test(model) ? { reasoning: { effort: "low" as const } } : {}),
        stream: true,
      },
      { signal: controller.signal }
    );

    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        reply += event.delta;
        send({ delta: event.delta });
      } else if (event.type === "response.failed" || event.type === "error") {
        throw new Error(`OpenAI stream failed: ${JSON.stringify(event)}`);
      }
    }

    send({ done: true });
  } catch (error: any) {
    if (!controller.signal.aborted) {
      logger.error(`Chatbot reply failed: ${error?.message}`);
      send({ error: FALLBACK_REPLY });
    }
  } finally {
    res.end();
  }

  // Save even a partial reply when the visitor closed the chat mid-stream
  const now = new Date();
  const toSave = [{ role: "user", content: message, createdAt: now }];
  if (reply.trim()) toSave.push({ role: "assistant", content: reply, createdAt: new Date() });

  try {
    await Chat.updateOne(
      { sessionId },
      {
        $push: { messages: { $each: toSave } },
        ...(pageUrl ? { $set: { pageUrl } } : {}),
      },
      { upsert: true }
    );
    // Put the visitor's first question on their enquiry so the team sees what they asked
    // (only while it still has no question — a reused enquiry keeps the earlier one)
    if (chat.enquiryId && (chat.messages || []).length === 0) {
      await ContactEnquiry.updateOne(
        { _id: chat.enquiryId, message: { $regex: `^${NO_QUESTION_PREFIX}` } },
        { $set: { message: `Chatbot question: ${message}` } }
      );
    }
  } catch (error: any) {
    logger.error(`Could not save chat ${sessionId}: ${error?.message}`);
  }
});

// ─── Admin panel ─────────────────────────────────────────────────────────────

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Chats started between ?from and ?to (ISO dates), optionally matching ?search. */
const buildChatFilter = (query: Request["query"]) => {
  const filter: Record<string, any> = {};
  const from = query.from ? new Date(String(query.from)) : null;
  const to = query.to ? new Date(String(query.to)) : null;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    throw ApiError.badRequest("Invalid date range");
  }
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }
  const search = String(query.search || "").trim().slice(0, 100);
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ "lead.name": rx }, { "lead.email": rx }, { "lead.phone": rx }, { "messages.content": rx }];
  }
  return filter;
};

const userMessages = { $filter: { input: "$messages", as: "m", cond: { $eq: ["$$m.role", "user"] } } };

// GET /api/admin/chats — paginated chat list (without full transcripts)
export const getRecentChats = asyncHandler(async (req: Request, res: Response) => {
  const filter = buildChatFilter(req.query);
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
  const limit = Math.min(1000, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));

  const [result] = await Chat.aggregate([
    { $match: filter },
    { $sort: { updatedAt: -1 } },
    {
      $facet: {
        chats: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              sessionId: 1,
              lead: 1,
              pageUrl: 1,
              enquiryId: 1,
              whatsappSentAt: 1,
              createdAt: 1,
              updatedAt: 1,
              messageCount: { $size: "$messages" },
              questionCount: { $size: userMessages },
              firstQuestion: { $arrayElemAt: [userMessages, 0] },
              lastMessage: { $arrayElemAt: ["$messages", -1] },
            },
          },
        ],
        total: [{ $count: "count" }],
      },
    },
  ]);

  const total = result?.total?.[0]?.count || 0;
  res.status(200).json(
    ApiResponse.ok("Chats fetched successfully", {
      chats: result?.chats || [],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  );
});

// GET /api/admin/chats/stats — totals, day-wise counts, top pages and latest questions
export const getChatStats = asyncHandler(async (req: Request, res: Response) => {
  const filter = buildChatFilter(req.query);

  const [result] = await Chat.aggregate([
    { $match: filter },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              chats: { $sum: 1 },
              leads: { $sum: { $cond: [{ $ifNull: ["$lead.phone", false] }, 1, 0] } },
              questions: { $sum: { $size: userMessages } },
              replies: { $sum: { $size: { $filter: { input: "$messages", as: "m", cond: { $eq: ["$$m.role", "assistant"] } } } } },
              whatsappSent: { $sum: { $cond: [{ $ifNull: ["$whatsappSentAt", false] }, 1, 0] } },
              engaged: { $sum: { $cond: [{ $gt: [{ $size: userMessages }, 0] }, 1, 0] } },
            },
          },
        ],
        daily: [
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } },
              chats: { $sum: 1 },
              questions: { $sum: { $size: userMessages } },
            },
          },
          { $sort: { _id: 1 } },
        ],
        topPages: [
          { $group: { _id: "$pageUrl", chats: { $sum: 1 } } },
          { $sort: { chats: -1 } },
          { $limit: 6 },
        ],
        latestQuestions: [
          { $unwind: "$messages" },
          { $match: { "messages.role": "user" } },
          { $sort: { "messages.createdAt": -1 } },
          { $limit: 8 },
          { $project: { chatId: "$_id", name: "$lead.name", content: "$messages.content", createdAt: "$messages.createdAt" } },
        ],
      },
    },
  ]);

  res.status(200).json(
    ApiResponse.ok("Chat stats fetched successfully", {
      totals: result?.totals?.[0] || { chats: 0, leads: 0, questions: 0, replies: 0, whatsappSent: 0, engaged: 0 },
      daily: (result?.daily || []).map((d: any) => ({ date: d._id, chats: d.chats, questions: d.questions })),
      topPages: (result?.topPages || []).map((p: any) => ({ pageUrl: p._id || "", chats: p.chats })),
      latestQuestions: result?.latestQuestions || [],
    })
  );
});

// GET /api/admin/chats/:id — one chat with its full transcript
export const getChatById = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!isValidObjectId(id)) throw ApiError.badRequest("Invalid chat id");
  const chat = await Chat.findById(id).lean();
  if (!chat) throw ApiError.notFound("Chat not found");
  res.status(200).json(ApiResponse.ok("Chat fetched successfully", chat));
});
