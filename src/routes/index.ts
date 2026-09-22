import { Router } from "express";
import uploadRouter from "../modules/upload/upload.routes";
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
import websiteOpportunitiesRouter from "../modules/website/websiteOpportunities.routes";
import websiteGalleryRouter from "../modules/website/gallery/gallery.routes";
import websiteAwardsRouter from "../modules/website/websiteAwards.routes";
import contactEnquiryRouter from "../modules/website/contact/contactEnquiry.routes";
import verifyRouter from "../modules/website/contact/verify.routes";
import blogPostRouter from "../modules/blogPost/blogPost.routes";
import careersRouter from "./careers.routes";

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
router.use("/careers", careersRouter);
router.use("/admin/careers", careersRouter);
router.use("/uploads", uploadRouter);
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
router.use("/website", websiteOpportunitiesRouter);
router.use("/website", websiteAwardsRouter);
router.use("/website/gallery", websiteGalleryRouter);
router.use("/gallery", websiteGalleryRouter);
router.use("/contact-enquiry", contactEnquiryRouter);
router.use("/website/contact-enquiry", contactEnquiryRouter);
router.use("/website/contact", contactEnquiryRouter);
router.use("/verify", verifyRouter);
router.use("/website/verify", verifyRouter);

export default router;


