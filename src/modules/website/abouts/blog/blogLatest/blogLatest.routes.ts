import express from "express";
import {
  getBlogLatest,
  updateBlogLatest,
} from "./blogLatest.controller";
import { protect } from "../../../../../middlewares/auth.middleware";

const router = express.Router();

router.get("/", getBlogLatest);
router.put("/", protect, updateBlogLatest);

export default router;
