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
import websiteWhyExhibitRouter from "../modules/website/websiteWhyExhibit.routes";
import websiteExhibitorListRouter from "../modules/website/websiteExhibitorList.routes";
import websiteWhyVisitRouter from "../modules/website/websiteWhyVisit.routes";

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
router.use("/uploads", uploadRouter);
router.use("/auth", authRouter);
router.use("/users/admin", staffRouter);
router.use("/roles", rolesRouter);
router.use("/website", websiteHomeRouter);
router.use("/website", websiteAboutRouter);
router.use("/website", websiteAdvisoryBoardMemberRouter);
router.use("/website", websiteBlogRouter);
router.use("/website", websiteBlogSlugRouter);
router.use("/website", websiteWhyExhibitRouter);
router.use("/website", websiteExhibitorListRouter);
router.use("/website", websiteWhyVisitRouter);

export default router;


