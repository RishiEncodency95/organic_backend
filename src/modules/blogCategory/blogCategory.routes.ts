import { Router } from "express";
import { protect } from "../../middlewares/auth.middleware";
import {
  createBlogCategory,
  deleteBlogCategory,
  getBlogCategories,
  getPublicBlogCategories,
  updateBlogCategory,
} from "./blogCategory.controller";

const router = Router();

router.get("/", getPublicBlogCategories);
router.get("/admin", protect, getBlogCategories);
router.post("/", protect, createBlogCategory);
router.patch("/:id", protect, updateBlogCategory);
router.put("/:id", protect, updateBlogCategory);
router.delete("/:id", protect, deleteBlogCategory);

export default router;
