import { Router } from "express";
import { protect } from "../../middlewares/auth.middleware";
import {
  createBlogExpert,
  deleteBlogExpert,
  getBlogExperts,
  getPublicBlogExperts,
  updateBlogExpert,
} from "./blogExpert.controller";

const router = Router();

router.get("/", getPublicBlogExperts);
router.get("/admin", protect, getBlogExperts);
router.post("/", protect, createBlogExpert);
router.patch("/:id", protect, updateBlogExpert);
router.put("/:id", protect, updateBlogExpert);
router.delete("/:id", protect, deleteBlogExpert);

export default router;
