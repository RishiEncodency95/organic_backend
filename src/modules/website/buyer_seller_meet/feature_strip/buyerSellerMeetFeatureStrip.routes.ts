import { Router } from "express";
import {
  getBuyerSellerMeetFeatureStrip,
  updateBuyerSellerMeetFeatureStrip,
  createBuyerSellerMeetFeatureStrip,
  getAllBuyerSellerMeetFeatureStrip,
  getBuyerSellerMeetFeatureStripById,
  updateBuyerSellerMeetFeatureStripById,
  deleteBuyerSellerMeetFeatureStripById,
} from "./buyerSellerMeetFeatureStrip.controller";

const router = Router();

router.get("/", getBuyerSellerMeetFeatureStrip);
router.put("/", updateBuyerSellerMeetFeatureStrip);
router.post("/", createBuyerSellerMeetFeatureStrip);
router.get("/all", getAllBuyerSellerMeetFeatureStrip);
router.get("/:id", getBuyerSellerMeetFeatureStripById);
router.put("/:id", updateBuyerSellerMeetFeatureStripById);
router.delete("/:id", deleteBuyerSellerMeetFeatureStripById);

export default router;
