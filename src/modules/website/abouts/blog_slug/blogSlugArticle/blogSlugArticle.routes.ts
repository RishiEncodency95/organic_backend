import express from "express";
import {
  getBlogSlugArticle,
  updateBlogSlugArticle,
} from "./blogSlugArticle.controller";
import { createUploader } from "../../../../../middlewares/upload.middleware";

const router = express.Router();
const uploader = createUploader("blogslugarticle");

router.get("/", getBlogSlugArticle);
router.put("/", uploader.single("image"), updateBlogSlugArticle);

export default router;
