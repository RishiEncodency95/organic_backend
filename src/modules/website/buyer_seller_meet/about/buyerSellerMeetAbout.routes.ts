import { Router } from "express";
import {
  getBuyerSellerMeetAbout,
  updateBuyerSellerMeetAbout,
  createBuyerSellerMeetAbout,
  getAllBuyerSellerMeetAbout,
  getBuyerSellerMeetAboutById,
  updateBuyerSellerMeetAboutById,
  deleteBuyerSellerMeetAboutById,
} from "./buyerSellerMeetAbout.controller";

const router = Router();

router.get("/", getBuyerSellerMeetAbout);
router.put("/", updateBuyerSellerMeetAbout);
router.post("/", createBuyerSellerMeetAbout);
router.get("/all", getAllBuyerSellerMeetAbout);
router.get("/:id", getBuyerSellerMeetAboutById);
router.put("/:id", updateBuyerSellerMeetAboutById);
router.delete("/:id", deleteBuyerSellerMeetAboutById);

export default router;
