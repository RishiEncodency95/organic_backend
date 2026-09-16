import { Router } from "express";
import {
  getBlogPosts,
  getBlogPostByIdOrSlug,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
} from "./blogPost.controller";
import { protect } from "../../middlewares/auth.middleware";

const router = Router();

router.get("/", getBlogPosts);
router.get("/:idOrSlug", getBlogPostByIdOrSlug);
router.post("/", protect, createBlogPost);
router.put("/:id", protect, updateBlogPost);
router.patch("/:id", protect, updateBlogPost);
router.delete("/:id", protect, deleteBlogPost);

export default router;
