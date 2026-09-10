import express from "express";
import {
  getBlogCta,
  updateBlogCta,
} from "./blogCta.controller";

const router = express.Router();

router.get("/", getBlogCta);
router.put("/", updateBlogCta);

export default router;
