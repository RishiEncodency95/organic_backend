import { Router } from "express";
import hotelStayRoutes from "./hotel_stay/categoryHotelStay.routes";
import logisticsRoutes from "./logistics/categoryLogistics.routes";
import manpowerSupplyRoutes from "./manpower_supply/categoryManpowerSupply.routes";
import printingBrandingRoutes from "./printing_branding/categoryPrintingBranding.routes";
import stallDesignRoutes from "./stall_design/categoryStallDesign.routes";
import travelRoutes from "./travel/categoryTravel.routes";

const router = Router();

router.use("/hotel-stay", hotelStayRoutes);
router.use("/logistics", logisticsRoutes);
router.use("/manpower-supply", manpowerSupplyRoutes);
router.use("/printing-branding", printingBrandingRoutes);
router.use("/stall-design", stallDesignRoutes);
router.use("/travel", travelRoutes);

export default router;
