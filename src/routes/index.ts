import { Router } from "express";
import uploadRouter from "../modules/upload/upload.routes";
import filesRouter from "../modules/files/files.routes";
import authRouter from "../modules/auth/auth.routes";
import staffRouter from "../modules/staff/staff.routes";
import rolesRouter from "../modules/roles/roles.routes";
import websiteHomeRouter from "../modules/website/websiteHome.routes";
import websiteAboutRouter from "../modules/website/websiteAbout.routes";
import websiteAdvisoryBoardMemberRouter from "../modules/website/websiteAdvisoryBoardMember.routes";
import websiteBlogRouter from "../modules/website/websiteBlog.routes";
import websiteBlogSlugRouter from "../modules/website/websiteBlogSlug.routes";
import seoRouter from "../modules/seo/seo.routes";
import advancedSeoRouter from "../modules/seo/advancedSeo.routes";
import settingsRouter from "../modules/settings/settings.routes";
import websiteWhyExhibitRouter from "../modules/website/websiteWhyExhibit.routes";
import websiteExhibitorListRouter from "../modules/website/websiteExhibitorList.routes";
import websiteWhyVisitRouter from "../modules/website/websiteWhyVisit.routes";
import websiteMsmePmsRouter from "../modules/website/websiteMsmePms.routes";
import websiteBuyerSellerMeetRouter from "../modules/website/websiteBuyerSellerMeet.routes";
import websiteExhibitionCategoriesRouter from "../modules/website/websiteExhibitionCategories.routes";
import websiteOpportunitiesRouter from "../modules/website/websiteOpportunities.routes";
import websiteGalleryRouter from "../modules/website/gallery/gallery.routes";
import websiteAwardsRouter from "../modules/website/websiteAwards.routes";
import websiteRegistrationRouter from "../modules/website/websiteRegistration.routes";
import contactEnquiryRouter from "../modules/website/contact/contactEnquiry.routes";
import verifyRouter from "../modules/website/contact/verify.routes";
import partnershipEnquiryRouter from "../modules/website/contact/partnershipEnquiry.routes";
import buyerEnquiryRouter from "../modules/website/buyerEnquiry/buyerEnquiry.routes";
import { visitorAdminRouter, visitorPublicRouter } from "../modules/website/visitorRegistration/visitorRegistration.routes";
import { exhibitorAdminRouter, exhibitorPublicRouter } from "../modules/expo/exhibitorRegistration.routes";
import blogPostRouter from "../modules/blogPost/blogPost.routes";
import careersRouter from "./careers.routes";
import msmeRouter from "./msme.routes";
import dashboardRouter from "../modules/dashboard/dashboard.routes";
import dropdownsRouter from "../modules/dropdowns/dropdowns.routes";
import locationsRouter from "../modules/locations/locations.routes";
import publicStaffRouter from "../modules/staff/publicStaff.routes";
import expoRouter from "../modules/expo/expo.routes";
import buyerConfigRouter from "../modules/dropdowns/buyerConfig.routes";
import systemServicesRouter from "../modules/systemServices/systemServices.routes";
import chatRouter from "../modules/chat/chat.routes";
import chatbotRouter from "../modules/chatbot/chatbot.routes";

const router = Router();

// Health Check Route
router.get("/health", (req, res) => {
    res.status(200).json({
        status: "success",
        message: "Server is healthy and running smoothly.",
        timestamp: new Date().toISOString(),
    });
});

// API Routes
router.use("/system-services", systemServicesRouter);
router.use("/", chatRouter);
router.use("/", chatbotRouter);
router.use("/dashboard", dashboardRouter);
router.use("/dropdowns", dropdownsRouter);
router.use("/", locationsRouter);
router.use("/public", publicStaffRouter);
router.use("/", expoRouter);
router.use("/", buyerConfigRouter);
router.use("/careers", careersRouter);
router.use("/admin/careers", careersRouter);
router.use("/msme", msmeRouter);
router.use("/uploads", uploadRouter);
router.use("/files", filesRouter);
router.use("/settings", settingsRouter);
router.use("/auth", authRouter);
router.use("/users/admin", staffRouter);
router.use("/roles", rolesRouter);
router.use("/seo", seoRouter);
router.use("/website/seo", seoRouter);
router.use("/seo-settings", advancedSeoRouter);
router.use("/website/seo-settings", advancedSeoRouter);
router.use("/website", websiteHomeRouter);
router.use("/website", websiteAboutRouter);
router.use("/website", websiteAdvisoryBoardMemberRouter);
router.use("/website", websiteBlogRouter);
router.use("/website", websiteBlogSlugRouter);
router.use("/blogs", blogPostRouter);
router.use("/website/blogs", blogPostRouter);
router.use("/website", websiteWhyExhibitRouter);
router.use("/website", websiteExhibitorListRouter);
router.use("/website", websiteWhyVisitRouter);
router.use("/website", websiteMsmePmsRouter);
router.use("/website", websiteBuyerSellerMeetRouter);
router.use("/website", websiteExhibitionCategoriesRouter);
router.use("/website", websiteOpportunitiesRouter);
router.use("/website", websiteAwardsRouter);
router.use("/website", websiteRegistrationRouter);
router.use("/website/gallery", websiteGalleryRouter);
router.use("/gallery", websiteGalleryRouter);
router.use("/contact-enquiry", contactEnquiryRouter);
router.use("/website/contact-enquiry", contactEnquiryRouter);
router.use("/website/contact", contactEnquiryRouter);
router.use("/partnership-enquiry", partnershipEnquiryRouter);
router.use("/buyer-enquiries", buyerEnquiryRouter);
// Visitor registration forms (/corporate-visitors, /general-visitors, ...) + admin list
router.use("/", visitorPublicRouter);
router.use("/visitor-registrations", visitorAdminRouter);
// Book a stand (/exhibitor-registration, /payment/create-order/:id, /payment/verify-payment) + admin list
router.use("/", exhibitorPublicRouter);
router.use("/exhibitor-registrations", exhibitorAdminRouter);
router.use("/verify", verifyRouter);
router.use("/website/verify", verifyRouter);

export default router;


