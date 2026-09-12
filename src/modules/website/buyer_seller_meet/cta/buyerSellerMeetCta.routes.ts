import { Router } from "express";
import {
  getBuyerSellerMeetCta,
  updateBuyerSellerMeetCta,
  createBuyerSellerMeetCta,
  getAllBuyerSellerMeetCta,
  getBuyerSellerMeetCtaById,
  updateBuyerSellerMeetCtaById,
  deleteBuyerSellerMeetCtaById,
} from "./buyerSellerMeetCta.controller";

const router = Router();

router.get("/", getBuyerSellerMeetCta);
router.put("/", updateBuyerSellerMeetCta);
router.post("/", createBuyerSellerMeetCta);
router.get("/all", getAllBuyerSellerMeetCta);
router.get("/:id", getBuyerSellerMeetCtaById);
router.put("/:id", updateBuyerSellerMeetCtaById);
router.delete("/:id", deleteBuyerSellerMeetCtaById);

export default router;
