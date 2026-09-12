import { Router } from "express";
import {
  getBuyerSellerMeetConnectWith,
  updateBuyerSellerMeetConnectWith,
  createBuyerSellerMeetConnectWith,
  getAllBuyerSellerMeetConnectWith,
  getBuyerSellerMeetConnectWithById,
  updateBuyerSellerMeetConnectWithById,
  deleteBuyerSellerMeetConnectWithById,
} from "./buyerSellerMeetConnectWith.controller";

const router = Router();

router.get("/", getBuyerSellerMeetConnectWith);
router.put("/", updateBuyerSellerMeetConnectWith);
router.post("/", createBuyerSellerMeetConnectWith);
router.get("/all", getAllBuyerSellerMeetConnectWith);
router.get("/:id", getBuyerSellerMeetConnectWithById);
router.put("/:id", updateBuyerSellerMeetConnectWithById);
router.delete("/:id", deleteBuyerSellerMeetConnectWithById);

export default router;
