import { Router } from "express";
import { protect } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { chatLimiter, chatLeadLimiter, chatHistoryLimiter, chatTrackLimiter } from "../../middlewares/rateLimiter.middleware";
import { validateRequest } from "../../middlewares/validate.middleware";
import { chatHistorySchema, chatLeadSchema, chatMessageSchema, chatStartSchema, chatTrackSchema } from "./chat.schema";
import { startChat, startByName, trackChat, sendChatMessage, getChatHistory, getRecentChats, getChatStats, getChatById } from "./chat.controller";
import { createManualEnquiry, saveInboxWorkflow } from "./inbox.controller";
import { getRoutingSettingsAdmin, saveRoutingSettings } from "./routingSettings.controller";

const router = Router();

// ---- Public: website chatbot (Organic Mitra) ----
router.post("/chat/lead", chatLeadLimiter, validateRequest(chatLeadSchema), startChat);
// The visitor's name (asked first in the chat); resumes their earlier chat from the same IP + name
router.post("/chat/start", chatLeadLimiter, validateRequest(chatStartSchema), startByName);
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
// Notification Settings: assignment rules and team alerts
router.get("/admin/chats/routing", ...canView, getRoutingSettingsAdmin);
router.put("/admin/chats/routing", ...canEdit, saveRoutingSettings);
router.get("/admin/chats/:id", ...canView, getChatById);

export default router;
