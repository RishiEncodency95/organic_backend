import { Router } from "express";
import { getJobs, getJobBySlug, exportJobDocx, getAdminJobsList, getAdminJobById, exportAdminJobDocx, createAdminJob, updateAdminJob, deleteAdminJob, generateJobDescription } from "../modules/careers/jobs.controller";
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
import {
  getAdminApplicationsBoard,
  updateAdminApplicationHr,
  addAdminApplicationNote,
} from "../modules/careers/applicationsBoard.controller";
import { getResultMessages, updateResultMessages } from "../modules/careers/resultMessages.controller";
import {
  getCareerOptions,
  getAdminCareerOptions,
  createCareerOption,
  updateCareerOption,
  deleteCareerOption,
} from "../modules/careers/options.controller";
import { uploadCvMiddleware } from "../middlewares/uploadCv.middleware";
import { uploadPhotoMiddleware } from "../middlewares/uploadPhoto.middleware";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

// PUBLIC CAREERS APIS
router.get("/jobs", getJobs);
router.get("/jobs/:slug/export", exportJobDocx);
router.get("/jobs/:slug", getJobBySlug);

router.post("/cv/upload", uploadCvMiddleware.any(), uploadCv);
router.post("/cv/analyze", analyzeCv);
router.get("/analysis/:id", getAnalysisResult);

router.patch("/candidates/:id", updateCandidateProfile);
router.post("/candidates/:id/photo", uploadPhotoMiddleware.any(), uploadCandidatePhoto);

router.get("/options", getCareerOptions);
// Messages shown on the eligibility result (edited in admin Career Settings → Result Messages)
router.get("/result-messages", getResultMessages);

router.post("/applications", createApplication);
router.get("/applications/:id", getApplication);
router.patch("/applications/:id", updateApplication);
router.post("/applications/:id/submit", submitApplication);

// ADMIN CAREERS APIS
router.get("/admin/jobs", protect, getAdminJobsList);
router.get("/admin/jobs/:id", protect, getAdminJobById);
router.get("/admin/jobs/:id/export", protect, exportAdminJobDocx);
router.post("/admin/jobs/generate-description", protect, generateJobDescription);
router.post("/admin/jobs", protect, createAdminJob);
router.patch("/admin/jobs/:id", protect, updateAdminJob);
router.delete("/admin/jobs/:id", protect, deleteAdminJob);

router.get("/admin/result-messages", protect, getResultMessages);
router.put("/admin/result-messages", protect, updateResultMessages);

router.get("/admin/options", protect, getAdminCareerOptions);
router.post("/admin/options", protect, createCareerOption);
router.patch("/admin/options/:id", protect, updateCareerOption);
router.delete("/admin/options/:id", protect, deleteCareerOption);

router.get("/admin/applications", protect, getAdminApplications);
// Flat rows for the admin "Applications & AI Response" screen (must stay above /:id).
router.get("/admin/applications-board", protect, getAdminApplicationsBoard);
router.patch("/admin/applications/:id/hr", protect, updateAdminApplicationHr);
router.post("/admin/applications/:id/notes", protect, addAdminApplicationNote);
router.get("/admin/applications/:id", protect, getAdminApplicationById);
router.patch("/admin/applications/:id/status", protect, updateAdminApplicationStatus);

export default router;
