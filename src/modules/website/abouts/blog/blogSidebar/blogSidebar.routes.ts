import express from "express";
import {
  getBlogSidebar,
  updateBlogSidebar,
} from "./blogSidebar.controller";
import { protect } from "../../../../../middlewares/auth.middleware";

const router = express.Router();

router.get("/", getBlogSidebar);
router.put("/", protect, updateBlogSidebar);

export default router;
