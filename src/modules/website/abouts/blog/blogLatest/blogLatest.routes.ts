import express from "express";
import {
  getBlogLatest,
  updateBlogLatest,
} from "./blogLatest.controller";

const router = express.Router();

router.get("/", getBlogLatest);
router.put("/", updateBlogLatest);

export default router;
