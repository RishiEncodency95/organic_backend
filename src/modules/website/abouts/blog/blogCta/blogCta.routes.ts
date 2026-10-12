import express from "express";
import {
  getBlogCta,
  updateBlogCta,
} from "./blogCta.controller";
import { protect } from "../../../../../middlewares/auth.middleware";

const router = express.Router();

router.get("/", getBlogCta);
router.put("/", protect, updateBlogCta);

export default router;
