import { Router } from "express";
import {
  getWhyVisitBuyerSeller,
  updateWhyVisitBuyerSeller,
  createWhyVisitBuyerSeller,
  getAllWhyVisitBuyerSeller,
  getWhyVisitBuyerSellerById,
  updateWhyVisitBuyerSellerById,
  deleteWhyVisitBuyerSellerById,
} from "./whyVisitBuyerSeller.controller";

const router = Router();

router.get("/", getWhyVisitBuyerSeller);
router.put("/", updateWhyVisitBuyerSeller);
router.post("/", createWhyVisitBuyerSeller);
router.get("/all", getAllWhyVisitBuyerSeller);
router.get("/:id", getWhyVisitBuyerSellerById);
router.put("/:id", updateWhyVisitBuyerSellerById);
router.delete("/:id", deleteWhyVisitBuyerSellerById);

export default router;
