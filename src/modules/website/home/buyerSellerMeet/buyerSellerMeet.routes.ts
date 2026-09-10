import { Router } from "express";
import { getBuyerSellerMeet, updateBuyerSellerMeet } from "./buyerSellerMeet.controller";
import { createUploader } from "../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("buyersellermeet");

router.get("/", getBuyerSellerMeet);
router.put("/", upload.fields([{ name: "image", maxCount: 1 }]), updateBuyerSellerMeet);
router.post("/", upload.fields([{ name: "image", maxCount: 1 }]), updateBuyerSellerMeet);

export default router;
