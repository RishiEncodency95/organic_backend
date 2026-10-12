import express from "express";
import {
  getBlogHero,
  updateBlogHero,
} from "./blogHero.controller";
import { protect } from "../../../../../middlewares/auth.middleware";
import { createUploader } from "../../../../../middlewares/upload.middleware";

const router = express.Router();
const uploader = createUploader("bloghero");

router.get("/", getBlogHero);
router.put("/", protect,
  uploader.fields([
    { name: "image", maxCount: 1 },
    { name: "secondaryImage", maxCount: 1 },
  ]),
  updateBlogHero
);

export default router;
