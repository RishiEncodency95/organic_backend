import express from "express";
import {
  getBlogVideos,
  updateBlogVideos,
} from "./blogVideos.controller";

const router = express.Router();

router.get("/", getBlogVideos);
router.put("/", updateBlogVideos);

export default router;
