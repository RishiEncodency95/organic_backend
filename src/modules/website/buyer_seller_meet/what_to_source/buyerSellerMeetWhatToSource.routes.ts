import { Router } from "express";
import {
  getBuyerSellerMeetWhatToSource,
  updateBuyerSellerMeetWhatToSource,
  createBuyerSellerMeetWhatToSource,
  getAllBuyerSellerMeetWhatToSource,
  getBuyerSellerMeetWhatToSourceById,
  updateBuyerSellerMeetWhatToSourceById,
  deleteBuyerSellerMeetWhatToSourceById,
} from "./buyerSellerMeetWhatToSource.controller";

const router = Router();

router.get("/", getBuyerSellerMeetWhatToSource);
router.put("/", updateBuyerSellerMeetWhatToSource);
router.post("/", createBuyerSellerMeetWhatToSource);
router.get("/all", getAllBuyerSellerMeetWhatToSource);
router.get("/:id", getBuyerSellerMeetWhatToSourceById);
router.put("/:id", updateBuyerSellerMeetWhatToSourceById);
router.delete("/:id", deleteBuyerSellerMeetWhatToSourceById);

export default router;
