import express from "express";
import {
  getBlogSlugSidebar,
  updateBlogSlugSidebar,
} from "./blogSlugSidebar.controller";

const router = express.Router();

router.get("/", getBlogSlugSidebar);
router.put("/", updateBlogSlugSidebar);

export default router;
