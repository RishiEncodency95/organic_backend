import { Router } from "express";
import {
  getWhyExhibitBuyers,
  updateWhyExhibitBuyers,
  createWhyExhibitBuyers,
  getAllWhyExhibitBuyers,
  getWhyExhibitBuyersById,
  updateWhyExhibitBuyersById,
  deleteWhyExhibitBuyersById,
} from "./whyExhibitBuyers.controller";
import { createUploader } from "../../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("whyexhibitbuyers");

const uploadFields = upload.fields([
  { name: "visual_0", maxCount: 1 },
  { name: "visual_1", maxCount: 1 },
  { name: "visual_2", maxCount: 1 },
]);

router.get("/", getWhyExhibitBuyers);
router.put("/", uploadFields, updateWhyExhibitBuyers);
router.post("/", uploadFields, updateWhyExhibitBuyers);

router.get("/list", getAllWhyExhibitBuyers);
router.get("/:id", getWhyExhibitBuyersById);
router.put("/:id", uploadFields, updateWhyExhibitBuyersById);
router.delete("/:id", deleteWhyExhibitBuyersById);

export default router;
