import express from "express";
import {
  getBlogExperts,
  updateBlogExperts,
} from "./blogExperts.controller";

const router = express.Router();

router.get("/", getBlogExperts);
router.put("/", updateBlogExperts);

export default router;
