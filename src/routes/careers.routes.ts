import { Router } from "express";
import { getJobs, getJobBySlug, exportJobDocx, getAdminJobsList, getAdminJobById, exportAdminJobDocx, createAdminJob, updateAdminJob, deleteAdminJob } from "../modules/careers/jobs.controller";
import { uploadCv, analyzeCv, getAnalysisResult } from "../modules/careers/cv.controller";
import {
  createApplication,
  getApplication,
  updateApplication,
  submitApplication,
  getAdminApplications,
  getAdminApplicationById,
  updateAdminApplicationStatus,
} from "../modules/careers/applications.controller";
import { uploadCvMiddleware } from "../middlewares/uploadCv.middleware";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

// PUBLIC CAREERS APIS
router.get("/jobs", getJobs);
router.get("/jobs/:slug/export", exportJobDocx);
router.get("/jobs/:slug", getJobBySlug);

router.post("/cv/upload", uploadCvMiddleware.any(), uploadCv);
router.post("/cv/analyze", analyzeCv);
router.get("/analysis/:id", getAnalysisResult);

router.post("/applications", createApplication);
router.get("/applications/:id", getApplication);
router.patch("/applications/:id", updateApplication);
router.post("/applications/:id/submit", submitApplication);

// ADMIN CAREERS APIS
router.get("/admin/jobs", protect, getAdminJobsList);
router.get("/admin/jobs/:id", protect, getAdminJobById);
router.get("/admin/jobs/:id/export", protect, exportAdminJobDocx);
router.post("/admin/jobs", protect, createAdminJob);
router.patch("/admin/jobs/:id", protect, updateAdminJob);
router.delete("/admin/jobs/:id", protect, deleteAdminJob);

router.get("/admin/applications", protect, getAdminApplications);
router.get("/admin/applications/:id", protect, getAdminApplicationById);
router.patch("/admin/applications/:id/status", protect, updateAdminApplicationStatus);

export default router;
