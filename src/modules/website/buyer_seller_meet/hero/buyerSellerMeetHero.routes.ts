import { Router } from "express";
import {
  getBuyerSellerMeetHero,
  updateBuyerSellerMeetHero,
  createBuyerSellerMeetHero,
  getAllBuyerSellerMeetHero,
  getBuyerSellerMeetHeroById,
  updateBuyerSellerMeetHeroById,
  deleteBuyerSellerMeetHeroById,
} from "./buyerSellerMeetHero.controller";

const router = Router();

router.get("/", getBuyerSellerMeetHero);
router.put("/", updateBuyerSellerMeetHero);
router.post("/", createBuyerSellerMeetHero);
router.get("/all", getAllBuyerSellerMeetHero);
router.get("/:id", getBuyerSellerMeetHeroById);
router.put("/:id", updateBuyerSellerMeetHeroById);
router.delete("/:id", deleteBuyerSellerMeetHeroById);

export default router;
