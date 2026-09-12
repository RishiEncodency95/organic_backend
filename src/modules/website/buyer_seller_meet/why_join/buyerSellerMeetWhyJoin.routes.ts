import { Router } from "express";
import {
  getBuyerSellerMeetWhyJoin,
  updateBuyerSellerMeetWhyJoin,
  createBuyerSellerMeetWhyJoin,
  getAllBuyerSellerMeetWhyJoin,
  getBuyerSellerMeetWhyJoinById,
  updateBuyerSellerMeetWhyJoinById,
  deleteBuyerSellerMeetWhyJoinById,
} from "./buyerSellerMeetWhyJoin.controller";

const router = Router();

router.get("/", getBuyerSellerMeetWhyJoin);
router.put("/", updateBuyerSellerMeetWhyJoin);
router.post("/", createBuyerSellerMeetWhyJoin);
router.get("/all", getAllBuyerSellerMeetWhyJoin);
router.get("/:id", getBuyerSellerMeetWhyJoinById);
router.put("/:id", updateBuyerSellerMeetWhyJoinById);
router.delete("/:id", deleteBuyerSellerMeetWhyJoinById);

export default router;
