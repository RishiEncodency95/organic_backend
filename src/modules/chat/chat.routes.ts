import { Router } from "express";
import { protect } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { chatLimiter, chatLeadLimiter, chatHistoryLimiter, chatTrackLimiter } from "../../middlewares/rateLimiter.middleware";
import { validateRequest } from "../../middlewares/validate.middleware";
import { chatHistorySchema, chatLeadSchema, chatMessageSchema, chatTrackSchema } from "./chat.schema";
import { startChat, trackChat, sendChatMessage, getChatHistory, getRecentChats, getChatStats, getChatById } from "./chat.controller";
import { createManualEnquiry, saveInboxWorkflow } from "./inbox.controller";

const router = Router();

// ---- Public: website chatbot (Organic Mitra) ----
router.post("/chat/lead", chatLeadLimiter, validateRequest(chatLeadSchema), startChat);
router.post("/chat/history", chatHistoryLimiter, validateRequest(chatHistorySchema), getChatHistory);
router.post("/chat/track", chatTrackLimiter, validateRequest(chatTrackSchema), trackChat);
router.post("/chat", chatLimiter, validateRequest(chatMessageSchema), sendChatMessage);

// ---- Admin ----
const canView = [protect, requirePermission("perm_enquiries_view")];
router.get("/admin/chats", ...canView, getRecentChats);
router.get("/admin/chats/stats", ...canView, getChatStats);
// Inbox & Leads: follow-up state and enquiries added by hand
const canEdit = [protect, requirePermission("perm_enquiries_reply")];
router.put("/admin/chats/workflow", ...canEdit, saveInboxWorkflow);
router.post("/admin/chats/manual", ...canEdit, createManualEnquiry);
router.get("/admin/chats/:id", ...canView, getChatById);

export default router;
