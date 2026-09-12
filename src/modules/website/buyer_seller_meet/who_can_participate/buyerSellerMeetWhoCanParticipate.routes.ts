import { Router } from "express";
import {
  getBuyerSellerMeetWhoCanParticipate,
  updateBuyerSellerMeetWhoCanParticipate,
  createBuyerSellerMeetWhoCanParticipate,
  getAllBuyerSellerMeetWhoCanParticipate,
  getBuyerSellerMeetWhoCanParticipateById,
  updateBuyerSellerMeetWhoCanParticipateById,
  deleteBuyerSellerMeetWhoCanParticipateById,
} from "./buyerSellerMeetWhoCanParticipate.controller";

const router = Router();

router.get("/", getBuyerSellerMeetWhoCanParticipate);
router.put("/", updateBuyerSellerMeetWhoCanParticipate);
router.post("/", createBuyerSellerMeetWhoCanParticipate);
router.get("/all", getAllBuyerSellerMeetWhoCanParticipate);
router.get("/:id", getBuyerSellerMeetWhoCanParticipateById);
router.put("/:id", updateBuyerSellerMeetWhoCanParticipateById);
router.delete("/:id", deleteBuyerSellerMeetWhoCanParticipateById);

export default router;
