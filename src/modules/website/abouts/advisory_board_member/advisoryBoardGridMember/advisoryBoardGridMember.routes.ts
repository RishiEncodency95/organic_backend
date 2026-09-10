import express from "express";
import {
  createAdvisoryBoardGridMember,
  getAdvisoryBoardGridMembers,
  getAdvisoryBoardGridMemberById,
  updateAdvisoryBoardGridMember,
  deleteAdvisoryBoardGridMember,
} from "./advisoryBoardGridMember.controller";
import { createUploader } from "../../../../../middlewares/upload.middleware";

const router = express.Router();
const uploader = createUploader("advisorymember");

router.post("/", uploader.single("image"), createAdvisoryBoardGridMember);
router.get("/", getAdvisoryBoardGridMembers);
router.get("/:id", getAdvisoryBoardGridMemberById);
router.put("/:id", uploader.single("image"), updateAdvisoryBoardGridMember);
router.delete("/:id", deleteAdvisoryBoardGridMember);

export default router;
