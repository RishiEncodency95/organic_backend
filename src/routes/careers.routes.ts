import { Router } from "express";
import { getJobs, getJobBySlug, createAdminJob, updateAdminJob, deleteAdminJob } from "../modules/careers/jobs.controller";
import {
  uploadCv,
  analyzeCv,
  getAnalysisResult,
  uploadCandidatePhoto,
  updateCandidateProfile,
} from "../modules/careers/cv.controller";
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
import { uploadPhotoMiddleware } from "../middlewares/uploadPhoto.middleware";

const router = Router();

// PUBLIC CAREERS APIS
router.get("/jobs", getJobs);
router.get("/jobs/:slug", getJobBySlug);

router.post("/cv/upload", uploadCvMiddleware.any(), uploadCv);
router.post("/cv/analyze", analyzeCv);
router.get("/analysis/:id", getAnalysisResult);

router.patch("/candidates/:id", updateCandidateProfile);
router.post("/candidates/:id/photo", uploadPhotoMiddleware.any(), uploadCandidatePhoto);

router.post("/applications", createApplication);
router.get("/applications/:id", getApplication);
router.patch("/applications/:id", updateApplication);
router.post("/applications/:id/submit", submitApplication);

// ADMIN CAREERS APIS
router.get("/admin/jobs", getJobs);
router.post("/admin/jobs", createAdminJob);
router.patch("/admin/jobs/:id", updateAdminJob);
router.delete("/admin/jobs/:id", deleteAdminJob);

router.get("/admin/applications", getAdminApplications);
router.get("/admin/applications/:id", getAdminApplicationById);
router.patch("/admin/applications/:id/status", updateAdminApplicationStatus);

export default router;
