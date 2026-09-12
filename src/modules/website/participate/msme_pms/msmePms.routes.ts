import { Router, Request, Response } from "express";
import bannerRoutes from "./banner/msmePmsBanner.routes";
import featureStripRoutes from "./featureStrip/msmeFeatureStrip.routes";
import officialRecognitionRoutes from "./officialRecognition/msmeOfficialRecognition.routes";
import pmsSchemeRoutes from "./pmsScheme/msmePmsScheme.routes";
import financialAssistanceRoutes from "./financialAssistance/msmeFinancialAssistance.routes";
import supportCoverRoutes from "./supportCover/msmeSupportCover.routes";
import supportSectionRoutes from "./supportSection/msmeSupportSection.routes";
import whatsNextRoutes from "./whatsNext/msmeWhatsNext.routes";
import needHelpRoutes from "./needHelp/msmeNeedHelp.routes";
import officialMessageRoutes from "./officialMessage/msmeOfficialMessage.routes";
import documentsRoutes from "./documents/msmeDocuments.routes";
import whyParticipateRoutes from "./whyParticipate/msmeWhyParticipate.routes";
import faqRoutes from "./faq/msmeFaq.routes";
import finalCtaRoutes from "./finalCta/msmeFinalCta.routes";

import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import { getMsmePmsBannerService } from "./banner/msmePmsBanner.service";
import { getMsmeFeatureStripService } from "./featureStrip/msmeFeatureStrip.service";
import { getMsmeOfficialRecognitionService } from "./officialRecognition/msmeOfficialRecognition.service";
import { getMsmePmsSchemeService } from "./pmsScheme/msmePmsScheme.service";
import { getMsmeFinancialAssistanceService } from "./financialAssistance/msmeFinancialAssistance.service";
import { getMsmeSupportCoverService } from "./supportCover/msmeSupportCover.service";
import { getMsmeSupportSectionService } from "./supportSection/msmeSupportSection.service";
import { getMsmeWhatsNextService } from "./whatsNext/msmeWhatsNext.service";
import { getMsmeNeedHelpService } from "./needHelp/msmeNeedHelp.service";
import { getMsmeOfficialMessageService } from "./officialMessage/msmeOfficialMessage.service";
import { getMsmeDocumentsService } from "./documents/msmeDocuments.service";
import { getMsmeWhyParticipateService } from "./whyParticipate/msmeWhyParticipate.service";
import { getMsmeFaqService } from "./faq/msmeFaq.service";
import { getMsmeFinalCtaService } from "./finalCta/msmeFinalCta.service";

const router = Router();

// Sub-routes
router.use("/banner", bannerRoutes);
router.use("/feature-strip", featureStripRoutes);
router.use("/official-recognition", officialRecognitionRoutes);
router.use("/pms-scheme", pmsSchemeRoutes);
router.use("/financial-assistance", financialAssistanceRoutes);
router.use("/support-cover", supportCoverRoutes);
router.use("/support-section", supportSectionRoutes);
router.use("/whats-next", whatsNextRoutes);
router.use("/need-help", needHelpRoutes);
router.use("/official-message", officialMessageRoutes);
router.use("/documents", documentsRoutes);
router.use("/why-participate", whyParticipateRoutes);
router.use("/faq", faqRoutes);
router.use("/final-cta", finalCtaRoutes);

// GET /all or / - Fetch full MSME PMS page data payload
router.get("/", asyncHandler(async (_req: Request, res: Response) => {
  const [
    banner,
    featureStrip,
    officialRecognition,
    pmsScheme,
    financialAssistance,
    supportCover,
    supportSection,
    whatsNext,
    needHelp,
    officialMessage,
    documents,
    whyParticipate,
    faq,
    finalCta,
  ] = await Promise.all([
    getMsmePmsBannerService(),
    getMsmeFeatureStripService(),
    getMsmeOfficialRecognitionService(),
    getMsmePmsSchemeService(),
    getMsmeFinancialAssistanceService(),
    getMsmeSupportCoverService(),
    getMsmeSupportSectionService(),
    getMsmeWhatsNextService(),
    getMsmeNeedHelpService(),
    getMsmeOfficialMessageService(),
    getMsmeDocumentsService(),
    getMsmeWhyParticipateService(),
    getMsmeFaqService(),
    getMsmeFinalCtaService(),
  ]);

  res.status(200).json(
    new ApiResponse(200, "Full MSME PMS page data fetched successfully", {
      banner,
      featureStrip,
      officialRecognition,
      pmsScheme,
      financialAssistance,
      supportCover,
      supportSection,
      whatsNext,
      needHelp,
      officialMessage,
      documents,
      whyParticipate,
      faq,
      finalCta,
    })
  );
}));

export default router;
