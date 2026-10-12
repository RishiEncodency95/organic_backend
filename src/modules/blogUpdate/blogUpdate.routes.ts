import { Router } from "express";
import { protect } from "../../middlewares/auth.middleware";
import {
  createBlogUpdate,
  deleteBlogUpdate,
  getBlogUpdates,
  getPublicBlogUpdates,
  updateBlogUpdate,
} from "./blogUpdate.controller";

const router = Router();

router.get("/", getPublicBlogUpdates);
router.get("/admin", protect, getBlogUpdates);
router.post("/", protect, createBlogUpdate);
router.patch("/:id", protect, updateBlogUpdate);
router.put("/:id", protect, updateBlogUpdate);
router.delete("/:id", protect, deleteBlogUpdate);

export default router;
