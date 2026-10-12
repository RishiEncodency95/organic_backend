import express from "express";
import {
  getBlogVideos,
  updateBlogVideos,
} from "./blogVideos.controller";
import { protect } from "../../../../../middlewares/auth.middleware";

const router = express.Router();

router.get("/", getBlogVideos);
router.put("/", protect, updateBlogVideos);

export default router;
