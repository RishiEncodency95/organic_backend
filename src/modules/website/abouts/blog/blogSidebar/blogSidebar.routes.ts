import express from "express";
import {
  getBlogSidebar,
  updateBlogSidebar,
} from "./blogSidebar.controller";

const router = express.Router();

router.get("/", getBlogSidebar);
router.put("/", updateBlogSidebar);

export default router;
