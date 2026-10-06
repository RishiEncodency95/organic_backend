import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import Chat from "../../models/chat/Chat.model";
import Otp from "../../models/contact/otp.model";
import ContactEnquiry from "../../models/contact/contactEnquiry.model";
import asyncHandler from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { ApiResponse } from "../../utils/ApiResponse";
import { logger } from "../../utils/logger";
import { env } from "../../config/env";
import { sendWhatsAppTemplate } from "../../services/whatsapp.service";
import { buildInstructions, FALLBACK_REPLY, NO_ANSWER_MARKER } from "./chat.prompt";
import { getBotContext, getOpenAI } from "../chatbot/chatbot.service";
import { toTenDigitMobile } from "./chat.schema";

const HISTORY_LIMIT = 10;
const WHATSAPP_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DUPLICATE_ENQUIRY_MS = 24 * 60 * 60 * 1000;
const CHATBOT_SERVICE = "Chatbot (Organic Mitra)";
const NO_QUESTION_PREFIX = "Started a chat with Organic Mitra on";


/** The visitor's IP and browser; a chat is saved as "Visitor <ip>" until the mobile number is verified */
const visitorOf = (req: Request) => {
  const raw = String(req.ip || req.socket.remoteAddress || "").replace(/^::ffff:/, "");
  const ip = raw === "::1" ? "127.0.0.1" : raw || "unknown";
  return {
    visitorName: `Visitor ${ip}`,
    visitor: { ip, userAgent: String(req.get("user-agent") || "").slice(0, 300) },
  };
};

// POST /api/chat/track — saves what a visitor does before the details form (topic / option
// clicks, scripted replies, a waiting question) and the 👍 / 👎 feedback, under the visitor's IP
export const trackChat = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = String(req.body.sessionId).trim();
  const pageUrl = req.body.pageUrl ? String(req.body.pageUrl).slice(0, 500) : "";
  const messages: { role: "user" | "assistant"; content: string }[] = req.body.messages || [];
  const { visitorName, visitor } = visitorOf(req);
  const now = Date.now();

  await Chat.updateOne(
    { sessionId },
    {
      $setOnInsert: { visitorName },
      $set: {
        visitor,
        ...(pageUrl ? { pageUrl } : {}),
        ...(req.body.feedback ? { feedback: req.body.feedback } : {}),
      },
      ...(messages.length
        ? { $push: { messages: { $each: messages.map((m, i) => ({ ...m, createdAt: new Date(now + i) })) } } }
        : {}),
    },
    { upsert: true }
  );

  res.status(200).json(ApiResponse.ok("Saved", null));
});

type ChatRequest = { type: string; stallSize?: string; company?: string; preferredTime?: string };

/** One line for the WhatsApp templates: "Chat enquiry", "Stall quotation – 9 sqm (Acme)", "Callback – Morning" */
const describeEnquiry = (request: ChatRequest | null): string => {
  if (!request) return "Chat enquiry";
  const parts =
    request.type === "sales-callback"
      ? ["Callback request", request.stallSize, request.preferredTime]
      : ["Stall quotation", request.stallSize, request.company];
  return parts.filter(Boolean).join(" – ");
};

/**
 * Sent once the mobile number is verified with the WhatsApp OTP: a confirmation with the
 * visitor's details to the visitor, plus an enquiry copy to the admin number.
 * Template variables — visitor: {{1}} name, {{2}} mobile, {{3}} enquiry;
 * admin: {{1}} name, {{2}} mobile, {{3}} enquiry, {{4}} page.
 * A plain chat start notifies at most once per number per 24 hours; quotation and callback
 * requests always notify.
 */
const notifyOnWhatsApp = async (
  sessionId: string,
  lead: { name: string; phone: string },
  pageUrl: string,
  request: ChatRequest | null
) => {
  if (!request) {
    const recentlySent = await Chat.exists({
      "lead.phone": lead.phone,
      whatsappSentAt: { $gte: new Date(Date.now() - WHATSAPP_COOLDOWN_MS) },
    });
    if (recentlySent) return;
  }

  const userCampaign = process.env.AISENSY_CAMPAIGN_CHAT_USER;
  const adminCampaign = process.env.AISENSY_CAMPAIGN_CHAT_ADMIN;
  const adminNumber = process.env.ADMIN_WHATSAPP_NUMBER;
  if (!userCampaign) logger.warn("Chatbot WhatsApp to visitor skipped: AISENSY_CAMPAIGN_CHAT_USER is not set");
  if (!adminCampaign || !adminNumber) {
    logger.warn("Chatbot WhatsApp to admin skipped: AISENSY_CAMPAIGN_CHAT_ADMIN or ADMIN_WHATSAPP_NUMBER is not set");
  }

  const enquiry = describeEnquiry(request);
  const [userSent] = await Promise.all([
    userCampaign
      ? sendWhatsAppTemplate({
          campaignName: userCampaign,
          phone: lead.phone,
          userName: lead.name,
          templateParams: [lead.name, `+91 ${lead.phone}`, enquiry],
          source: "website-chatbot",
        })
      : Promise.resolve(false),
    adminCampaign && adminNumber
      ? sendWhatsAppTemplate({
          campaignName: adminCampaign,
          phone: adminNumber,
          userName: "Admin",
          templateParams: [lead.name, `+91 ${lead.phone}`, enquiry, pageUrl || "Website"],
          source: "website-chatbot-admin",
        })
      : Promise.resolve(false),
  ]);

  if (userSent) {
    await Chat.updateOne({ sessionId }, { $set: { whatsappSentAt: new Date() } });
  }
};

/** Must match LEAD_OTP_PROFILE in the website's chat panel */
export const CHAT_LEAD_OTP_PROFILE = "CHAT_LEAD";

// POST /api/chat/lead — visitor details collected before the chat starts
export const startChat = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = String(req.body.sessionId).trim();
  const pageUrl = String(req.body.pageUrl || "").slice(0, 500);
  const lead = {
    name: String(req.body.name).trim().replace(/\s+/g, " "),
    phone: toTenDigitMobile(String(req.body.phone)),
    ...(req.body.email ? { email: String(req.body.email).trim().toLowerCase() } : {}),
  };
  const request = req.body.enquiryType
    ? {
        type: req.body.enquiryType,
        stallSize: req.body.stallSize || undefined,
        company: req.body.company || undefined,
        preferredTime: req.body.preferredTime || undefined,
      }
    : null;

  const existing = await Chat.findOne({ sessionId }).select("enquiryId lead.phone").lean();

  // The details, quotation and callback forms prove the visitor owns this number with a WhatsApp
  // OTP, verified in the browser; here the server confirms (and consumes) the verified record.
  // Not asked again when this chat already has the same number. Outside production the dev
  // master OTP verifies without a record, so the check is skipped there.
  const newNumber = existing?.lead?.phone !== lead.phone;
  // Used up only after the lead is saved, so a retry after a failed save still works
  const proof = newNumber ? await Otp.findOne({ phone: lead.phone, isVerified: true, profile: CHAT_LEAD_OTP_PROFILE }).select("_id").lean() : null;
  if (newNumber) {
    if (!proof && env.NODE_ENV === "production") {
      throw ApiError.badRequest("Please verify your mobile number with the WhatsApp OTP.");
    }
  }
  const { visitorName, visitor } = visitorOf(req);

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
    {
      $set: { lead, pageUrl, enquiryId, visitor, ...(newNumber ? { phoneVerifiedAt: new Date() } : {}) },
      $setOnInsert: { visitorName },
      ...(request ? { $push: { requests: request } } : {}),
    },
    { upsert: true }
  );
  if (proof) await Otp.deleteOne({ _id: proof._id });

  notifyOnWhatsApp(sessionId, lead, pageUrl, request).catch((error) =>
    logger.warn(`Chatbot WhatsApp notification failed: ${error?.message}`)
  );

  res.status(201).json(ApiResponse.created("Chat started", { sessionId }));
});

export const CHAT_HISTORY_OTP_PROFILE = "CHAT_HISTORY";
const HISTORY_RESULTS = 5;

// POST /api/chat/history — a returning visitor's previous chats, only after OTP verification
export const getChatHistory = asyncHandler(async (req: Request, res: Response) => {
  const phone = req.body.phone ? toTenDigitMobile(String(req.body.phone)) : "";
  const email = phone ? "" : String(req.body.email || "").trim().toLowerCase();

  // The OTP is verified in the browser; here the server confirms (and consumes) the verified
  // record so nobody can read someone else's chats by just posting a number. Outside production
  // the dev master OTP verifies without a record, so the check is skipped there.
  const proof = await Otp.findOneAndDelete({
    ...(phone ? { phone } : { email }),
    isVerified: true,
    profile: CHAT_HISTORY_OTP_PROFILE,
  });
  if (!proof && env.NODE_ENV === "production") {
    throw ApiError.badRequest("Please verify with OTP to view your previous enquiry.");
  }

  const chats = await Chat.find(phone ? { "lead.phone": phone } : { "lead.email": email })
    .sort({ updatedAt: -1 })
    .limit(HISTORY_RESULTS)
    .select("lead.name requests messages createdAt updatedAt")
    .lean();

  // Session ids stay private: they would let anyone continue the chat as this visitor
  const history = chats.map((chat) => ({
    name: chat.lead?.name || "",
    startedAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    requests: (chat.requests || []).map(({ type, stallSize, preferredTime, createdAt }) => ({ type, stallSize, preferredTime, createdAt })),
    question: chat.messages?.find((m) => m.role === "user")?.content?.slice(0, 200) || "",
    messageCount: chat.messages?.length || 0,
  }));

  res.status(200).json(ApiResponse.ok("Previous chats", history));
});

// POST /api/chat — streams the assistant reply as Server-Sent Events
export const sendChatMessage = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = String(req.body.sessionId).trim();
  const message = String(req.body.message).trim().slice(0, 1000);
  const pageUrl = req.body.pageUrl ? String(req.body.pageUrl).slice(0, 500) : undefined;

  const { visitorName, visitor } = visitorOf(req);

  // Visitors chat freely: until the mobile number is verified the chat is saved as "Visitor <ip>"
  const chat = await Chat.findOne({ sessionId })
    .select({ lead: 1, enquiryId: 1, messages: { $slice: -HISTORY_LIMIT } })
    .lean();
  const { ctx, settings } = await getBotContext("live");
  if (settings.enabled === false) {
    throw new ApiError(503, "The chat assistant is switched off right now.");
  }

  // A question already saved by trackChat (asked just before) is not saved or sent twice
  const history = chat?.messages || [];
  const last = history[history.length - 1];
  const alreadySaved = last?.role === "user" && last.content.trim() === message;
  const context = alreadySaved ? history.slice(0, -1) : history;

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

  // The model ends an unanswerable reply with NO_ANSWER_MARKER. Text that could be the start of
  // the marker is held back until it is clear, so the visitor never sees it.
  let reply = "";
  let sent = 0;
  const flush = (final: boolean) => {
    const clean = reply.split(NO_ANSWER_MARKER).join("");
    let safe = clean.length;
    if (!final) {
      for (let k = Math.min(NO_ANSWER_MARKER.length - 1, clean.length); k > 0; k--) {
        if (NO_ANSWER_MARKER.startsWith(clean.slice(-k))) {
          safe = clean.length - k;
          break;
        }
      }
    }
    if (safe > sent) {
      send({ delta: clean.slice(sent, safe) });
      sent = safe;
    }
  };

  try {
    const client = getOpenAI();
    if (!client) throw new Error("OPENAI_API_KEY is not configured");

    const model = env.OPENAI_MODEL;
    const stream = await client.responses.create(
      {
        model,
        instructions: buildInstructions(chat?.lead?.name || undefined, ctx),
        input: [
          ...context.map((m) => ({ role: m.role, content: m.content })),
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
        flush(false);
      } else if (event.type === "response.failed" || event.type === "error") {
        throw new Error(`OpenAI stream failed: ${JSON.stringify(event)}`);
      }
    }

    flush(true);
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
  const needsReview = reply.includes(NO_ANSWER_MARKER);
  const replyText = reply.split(NO_ANSWER_MARKER).join("").trim();
  const now = new Date();
  const toSave: { role: "user" | "assistant"; content: string; createdAt: Date; needsReview?: boolean }[] = alreadySaved
    ? []
    : [{ role: "user", content: message, createdAt: now }];
  if (replyText) toSave.push({ role: "assistant", content: replyText, createdAt: new Date(), ...(needsReview ? { needsReview } : {}) });

  try {
    await Chat.updateOne(
      { sessionId },
      {
        $push: { messages: { $each: toSave } },
        $set: { visitor, ...(pageUrl ? { pageUrl } : {}) },
        $setOnInsert: { visitorName },
      },
      { upsert: true }
    );
    // Put the visitor's first question on their enquiry so the team sees what they asked
    // (only while it still has no question — a reused enquiry keeps the earlier one)
    if (chat?.enquiryId) {
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
    filter.$or = [
      { "lead.name": rx },
      { "lead.email": rx },
      { "lead.phone": rx },
      { visitorName: rx },
      { "visitor.ip": rx },
      { "messages.content": rx },
    ];
  }
  return filter;
};

const userMessages = { $filter: { input: "$messages", as: "m", cond: { $eq: ["$$m.role", "user"] } } };
const assistantMessages = { $filter: { input: "$messages", as: "m", cond: { $eq: ["$$m.role", "assistant"] } } };

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
              visitorName: 1,
              visitor: 1,
              phoneVerifiedAt: 1,
              feedback: 1,
              requests: 1,
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
              verifiedLeads: { $sum: { $cond: [{ $ifNull: ["$phoneVerifiedAt", false] }, 1, 0] } },
              // Quotation / callback requests: the sales team takes these over
              handovers: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ["$requests", []] } }, 0] }, 1, 0] } },
              feedbackYes: { $sum: { $cond: [{ $eq: ["$feedback", "yes"] }, 1, 0] } },
              feedbackNo: { $sum: { $cond: [{ $eq: ["$feedback", "no"] }, 1, 0] } },
              // Questions with no reply saved after them (AI failed, or the visitor left at the details form)
              unanswered: { $sum: { $max: [0, { $subtract: [{ $size: userMessages }, { $size: assistantMessages }] }] } },
            },
          },
        ],
        // Numbers that started more than one chat
        returning: [
          { $match: { "lead.phone": { $nin: [null, ""] } } },
          { $group: { _id: "$lead.phone", chats: { $sum: 1 } } },
          { $match: { chats: { $gt: 1 } } },
          { $count: "count" },
        ],
        popularQuestions: [
          { $unwind: "$messages" },
          { $match: { "messages.role": "user" } },
          { $group: { _id: { $toLower: { $trim: { input: "$messages.content" } } }, question: { $first: "$messages.content" }, count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } },
          { $limit: 5 },
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
          { $project: { chatId: "$_id", name: { $ifNull: ["$lead.name", "$visitorName"] }, content: "$messages.content", createdAt: "$messages.createdAt" } },
        ],
      },
    },
  ]);

  res.status(200).json(
    ApiResponse.ok("Chat stats fetched successfully", {
      totals: {
        ...(result?.totals?.[0] || {
          chats: 0,
          leads: 0,
          questions: 0,
          replies: 0,
          whatsappSent: 0,
          engaged: 0,
          verifiedLeads: 0,
          handovers: 0,
          feedbackYes: 0,
          feedbackNo: 0,
          unanswered: 0,
        }),
        returningVisitors: result?.returning?.[0]?.count || 0,
      },
      popularQuestions: (result?.popularQuestions || []).map((q: any) => ({ question: q.question, count: q.count })),
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
