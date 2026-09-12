import { Router } from "express";
import buyerSellerMeetRoutes from "./buyer_seller_meet/buyerSellerMeet.routes";

const router = Router();

// Mount buyer_seller_meet section routes under /buyer-seller-meet
router.use("/buyer-seller-meet", buyerSellerMeetRoutes);

export default router;
