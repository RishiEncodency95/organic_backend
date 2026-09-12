import { Router } from "express";
import {
  getBuyerSellerMeetHowItWorks,
  updateBuyerSellerMeetHowItWorks,
  createBuyerSellerMeetHowItWorks,
  getAllBuyerSellerMeetHowItWorks,
  getBuyerSellerMeetHowItWorksById,
  updateBuyerSellerMeetHowItWorksById,
  deleteBuyerSellerMeetHowItWorksById,
} from "./buyerSellerMeetHowItWorks.controller";

const router = Router();

router.get("/", getBuyerSellerMeetHowItWorks);
router.put("/", updateBuyerSellerMeetHowItWorks);
router.post("/", createBuyerSellerMeetHowItWorks);
router.get("/all", getAllBuyerSellerMeetHowItWorks);
router.get("/:id", getBuyerSellerMeetHowItWorksById);
router.put("/:id", updateBuyerSellerMeetHowItWorksById);
router.delete("/:id", deleteBuyerSellerMeetHowItWorksById);

export default router;
