import express from "express";
import {
  getBlogSlugBottomBanner,
  updateBlogSlugBottomBanner,
} from "./blogSlugBottomBanner.controller";

const router = express.Router();

router.get("/", getBlogSlugBottomBanner);
router.put("/", updateBlogSlugBottomBanner);

export default router;
