import express from "express";
import {
  getBlogFeatured,
  updateBlogFeatured,
} from "./blogFeatured.controller";

const router = express.Router();

router.get("/", getBlogFeatured);
router.put("/", updateBlogFeatured);

export default router;
