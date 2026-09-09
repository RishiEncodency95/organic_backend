import { Router } from "express";
import authRouter from "../modules/auth/auth.routes";
import staffRouter from "../modules/staff/staff.routes";
import rolesRouter from "../modules/roles/roles.routes";
import websiteHomeRouter from "../modules/website/websiteHome.routes";

const router = Router();

// Health check endpoint — check server status
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running ✅",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// All routes
router.use("/auth", authRouter);
router.use("/users/admin", staffRouter);
router.use("/roles", rolesRouter);
router.use("/website", websiteHomeRouter);

export default router;
