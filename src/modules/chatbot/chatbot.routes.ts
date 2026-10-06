import { Router } from "express";
import multer from "multer";
import { protect } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import {
  checkSources,
  createSource,
  deleteSource,
  dismissReview,
  getManager,
  getPublicChatConfig,
  getReviewQueue,
  listSources,
  publishManager,
  restoreVersion,
  refreshSource,
  saveDraftSection,
  testBot,
  updateSource,
} from "./chatbot.controller";

const router = Router();

// Knowledge documents are read in memory and only their text is kept
const uploadKnowledge = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(pdf|docx|txt)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error("Only PDF, DOCX or TXT files can be imported."));
  },
});

// ---- Public: website chat ----
router.get("/chat/config", getPublicChatConfig);

// ---- Admin: Chatbot Manager ----
const canView = [protect, requirePermission("perm_enquiries_view", "perm_content_view")];
const canEdit = [protect, requirePermission("perm_content_edit", "perm_settings_manage")];

router.get("/admin/chatbot/manager", ...canView, getManager);
router.put("/admin/chatbot/manager/draft", ...canEdit, saveDraftSection);
router.post("/admin/chatbot/manager/publish", ...canEdit, publishManager);
router.post("/admin/chatbot/manager/restore", ...canEdit, restoreVersion);

router.get("/admin/chatbot/sources", ...canView, listSources);
router.post("/admin/chatbot/sources", ...canEdit, uploadKnowledge.single("file"), createSource);
router.post("/admin/chatbot/sources/check", ...canEdit, checkSources);
router.post("/admin/chatbot/sources/:id/refresh", ...canEdit, refreshSource);
router.patch("/admin/chatbot/sources/:id", ...canEdit, updateSource);
router.delete("/admin/chatbot/sources/:id", ...canEdit, deleteSource);

router.post("/admin/chatbot/test", ...canView, testBot);
router.get("/admin/chatbot/review", ...canView, getReviewQueue);
router.post("/admin/chatbot/review/dismiss", ...canEdit, dismissReview);

export default router;
