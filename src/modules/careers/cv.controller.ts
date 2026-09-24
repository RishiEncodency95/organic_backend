import { Request, Response } from "express";
import CandidateProfile from "../../models/careers/CandidateProfile.model";
import Job from "../../models/careers/Job.model";
import CvAnalysis from "../../models/careers/CvAnalysis.model";
import {
  uploadCvToCloudinary,
  uploadCandidatePhotoToCloudinary,
} from "../../services/cloudinary.service";
import { extractTextFromCv } from "../../services/cvTextExtractor.service";
import { extractPhotoFromCv } from "../../services/cvPhotoExtractor.service";
import { runCvAnalysisPipeline } from "../../services/ai/ai.service";

export const uploadCv = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file || (req.files && Array.isArray(req.files) ? req.files[0] : undefined);
    if (!file) {
      res.status(400).json({ success: false, message: "Please upload a CV document." });
      return;
    }

    const allowedMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    const isAllowedExt = /\.(pdf|doc|docx)$/i.test(file.originalname);

    // Both must look right — a renamed file should not pass on its name alone.
    if (!allowedMimeTypes.includes(file.mimetype) || !isAllowedExt) {
      res.status(400).json({
        success: false,
        message: "Invalid file type. Only PDF, DOC, and DOCX files are allowed.",
      });
      return;
    }

    // Maximum file size: 5 MB
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      res.status(400).json({
        success: false,
        message: "File size exceeds 5 MB limit.",
      });
      return;
    }

    // 1. Upload to Cloudinary
    const uploadResult = await uploadCvToCloudinary(
      file.buffer,
      file.originalname,
      file.mimetype
    );

    // 2. Extract CV text
    const rawText = await extractTextFromCv(file.buffer, file.mimetype, file.originalname);

    // 2b. Best-effort: pull out a headshot already embedded in the CV so the candidate
    // is not asked to upload one separately. Never blocks the upload on failure.
    let extractedPhotoUrl: string | undefined;
    try {
      const extractedPhoto = await extractPhotoFromCv(file.buffer, file.mimetype, file.originalname);
      if (extractedPhoto) {
        const photoUpload = await uploadCandidatePhotoToCloudinary(
          extractedPhoto.buffer,
          `cv_photo_${file.originalname}`,
          extractedPhoto.contentType
        );
        extractedPhotoUrl = photoUpload.url || undefined;
      }
    } catch (photoError) {
      console.warn("⚠️ Could not extract a photo from the CV:", (photoError as Error).message);
    }

    // 3. Create Candidate Profile in MongoDB
    const profile = await CandidateProfile.create({
      cv: {
        originalFileName: uploadResult.originalFileName,
        cloudinaryUrl: uploadResult.url,
        cloudinaryPublicId: uploadResult.publicId,
        fileType: uploadResult.format,
        fileSize: uploadResult.bytes,
        rawText,
      },
      ...(extractedPhotoUrl ? { photo: extractedPhotoUrl } : {}),
    });

    res.status(200).json({
      success: true,
      message: "CV uploaded and text extracted successfully.",
      data: {
        cvId: profile._id.toString(),
        candidateId: profile._id.toString(),
        fileName: uploadResult.originalFileName,
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        fileSize: uploadResult.bytes,
      },
    });
  } catch (error) {
    console.error("Upload CV error:", error);
    res.status(500).json({
      success: false,
      message: "Your CV could not be uploaded right now. Please try again.",
      error: (error as Error).message,
    });
  }
};

export const analyzeCv = async (req: Request, res: Response): Promise<void> => {
  try {
    const { candidateId, cvId, jobId } = req.body;
    const targetCandidateId = candidateId || cvId;

    if (!targetCandidateId || !jobId) {
      res.status(400).json({
        success: false,
        message: "candidateId and jobId are required.",
      });
      return;
    }

    const profile = await CandidateProfile.findById(targetCandidateId);
    if (!profile || !profile.cv?.rawText) {
      res.status(404).json({
        success: false,
        message: "Candidate profile or CV text not found.",
      });
      return;
    }

    let job = null;
    if (typeof jobId === "string" && jobId.match(/^[0-9a-fA-F]{24}$/)) {
      job = await Job.findById(jobId);
    }

    if (!job) {
      job = await Job.findOne({ slug: jobId });
    }

    if (!job && typeof jobId === "string") {
      const cleanTitle = jobId.replace(/[-_]/g, " ").trim();
      job = await Job.findOne({ title: new RegExp(cleanTitle, "i") });
    }

    if (!job) {
      job = await Job.findOne({ status: "OPEN" });
    }

    if (!job) {
      res.status(404).json({
        success: false,
        message: "Job position not found.",
      });
      return;
    }

    // Create preliminary analysis record
    const analysisDoc = await CvAnalysis.create({
      candidateId: profile._id,
      jobId: job._id,
      cvId: profile.cv.cloudinaryPublicId,
      status: "ANALYZING",
      eligibilityThreshold: job.eligibilityThreshold || 40,
    });

    // Run AI analysis pipeline (OpenAI with Gemini fallback + deterministic score engine)
    const analysisResult = await runCvAnalysisPipeline(profile.cv.rawText, {
      title: job.title,
      department: job.department,
      location: job.location,
      experienceMin: job.experienceMin,
      experienceMax: job.experienceMax,
      skills: job.skills,
      requirements: job.requirements,
      responsibilities: job.responsibilities,
      educationRequirements: job.educationRequirements,
      eligibilityThreshold: job.eligibilityThreshold,
    });

    // Update candidate profile with extracted non-hallucinated data if provided
    const ext = analysisResult.extractedProfile;
    if (ext.candidate.name) profile.name = ext.candidate.name;
    if (ext.candidate.email) profile.email = ext.candidate.email;
    if (ext.candidate.phone) profile.phone = ext.candidate.phone;
    // The whole list is stored so the OTP step can offer each number for verification.
    if (ext.candidate.phones && ext.candidate.phones.length > 0) {
      profile.phones = ext.candidate.phones;
    } else if (ext.candidate.phone) {
      profile.phones = [ext.candidate.phone];
    }
    if (ext.candidate.location) profile.location = ext.candidate.location;
    if (ext.candidate.linkedin) profile.linkedin = ext.candidate.linkedin;
    if (ext.education && ext.education.length > 0) profile.education = ext.education;
    if (ext.experience && ext.experience.length > 0) profile.experience = ext.experience;
    if (ext.skills && ext.skills.length > 0) profile.skills = ext.skills;
    if (ext.achievements && ext.achievements.length > 0) profile.achievements = ext.achievements;
    if (ext.languages && ext.languages.length > 0) profile.languages = ext.languages;
    if (ext.currentCompany) profile.currentCompany = ext.currentCompany;
    if (ext.currentDesignation) profile.currentDesignation = ext.currentDesignation;
    if (ext.totalExperience) profile.totalExperience = ext.totalExperience;
    if (ext.noticePeriod) profile.noticePeriod = ext.noticePeriod;
    if (ext.currentCTC) profile.currentCTC = ext.currentCTC;
    if (ext.expectedCTC) profile.expectedCTC = ext.expectedCTC;

    await profile.save();

    // Update analysis document with full result
    analysisDoc.provider = analysisResult.provider;
    analysisDoc.status = "COMPLETED";
    analysisDoc.extractedProfile = analysisResult.extractedProfile;
    analysisDoc.matchScore = analysisResult.overallScore;
    analysisDoc.eligibilityThreshold = analysisResult.eligibilityThreshold;
    analysisDoc.eligible = analysisResult.eligible;
    analysisDoc.breakdown = analysisResult.breakdown;
    analysisDoc.matchedRequirements = analysisResult.matchedRequirements;
    analysisDoc.missingRequirements = analysisResult.missingRequirements;
    analysisDoc.strengths = analysisResult.strengths;
    analysisDoc.gaps = analysisResult.gaps;
    analysisDoc.explanation = analysisResult.explanation;
    analysisDoc.analyzedAt = new Date();

    await analysisDoc.save();

    res.status(200).json({
      success: true,
      message: "CV analysis completed successfully.",
      data: {
        analysisId: analysisDoc._id.toString(),
        candidateId: profile._id.toString(),
        jobId: job._id.toString(),
        provider: analysisResult.provider,
        status: "COMPLETED",
        matchScore: analysisResult.overallScore,
        eligibilityThreshold: analysisResult.eligibilityThreshold,
        eligible: analysisResult.eligible,
        breakdown: analysisResult.breakdown,
        matchedRequirements: analysisResult.matchedRequirements,
        missingRequirements: analysisResult.missingRequirements,
        strengths: analysisResult.strengths,
        gaps: analysisResult.gaps,
        explanation: analysisResult.explanation,
        candidateProfile: profile,
      },
    });
  } catch (error) {
    console.error("CV Analysis Error:", error);
    res.status(500).json({
      success: false,
      message: "Your CV could not be analyzed right now. Please try again.",
      error: (error as Error).message,
    });
  }
};

export const getAnalysisResult = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const analysis = await CvAnalysis.findById(id)
      .populate("candidateId")
      .populate("jobId");

    if (!analysis) {
      res.status(404).json({ success: false, message: "Analysis record not found." });
      return;
    }

    res.status(200).json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch analysis record.",
      error: (error as Error).message,
    });
  }
};

/**
 * Saves the candidate's profile photo against their CV record.
 * POST /careers/candidates/:id/photo
 */
export const uploadCandidatePhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const file = req.file || (req.files && Array.isArray(req.files) ? req.files[0] : undefined);

    if (!file) {
      res.status(400).json({ success: false, message: "Please attach a photo." });
      return;
    }

    if (!file.mimetype.startsWith("image/")) {
      res.status(400).json({
        success: false,
        message: "Invalid file type. Only JPG, PNG and WEBP photos are allowed.",
      });
      return;
    }

    const profile = await CandidateProfile.findById(id);
    if (!profile) {
      res.status(404).json({ success: false, message: "Candidate profile not found." });
      return;
    }

    const uploadResult = await uploadCandidatePhotoToCloudinary(
      file.buffer,
      file.originalname,
      file.mimetype
    );

    if (!uploadResult.url) {
      res.status(502).json({
        success: false,
        message: "Your photo could not be stored right now. Please try again.",
      });
      return;
    }

    profile.photo = uploadResult.url;
    await profile.save();

    res.status(200).json({
      success: true,
      message: "Profile photo saved successfully.",
      data: {
        candidateId: profile._id.toString(),
        photo: profile.photo,
        url: uploadResult.url,
        publicId: uploadResult.publicId,
      },
    });
  } catch (error) {
    console.error("Candidate photo upload error:", error);
    res.status(500).json({
      success: false,
      message: "Your photo could not be uploaded right now. Please try again.",
      error: (error as Error).message,
    });
  }
};

/**
 * Persists the contact details the candidate corrected on the eligibility screen,
 * including which number the WhatsApp OTP was verified against.
 * PATCH /careers/candidates/:id
 */
export const updateCandidateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, phone, phones, verifiedPhone, linkedin, photo } = req.body;

    const profile = await CandidateProfile.findById(id);
    if (!profile) {
      res.status(404).json({ success: false, message: "Candidate profile not found." });
      return;
    }

    if (typeof name === "string" && name.trim()) profile.name = name.trim();
    if (typeof email === "string" && email.trim()) profile.email = email.trim();
    if (typeof phone === "string" && phone.trim()) profile.phone = phone.trim();
    if (typeof verifiedPhone === "string" && verifiedPhone.trim()) {
      profile.verifiedPhone = verifiedPhone.trim();
    }
    if (typeof linkedin === "string") profile.linkedin = linkedin.trim();
    if (typeof photo === "string" && photo.trim()) profile.photo = photo.trim();
    if (Array.isArray(phones)) {
      const cleaned = phones
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean);
      if (cleaned.length > 0) profile.phones = cleaned;
    }

    await profile.save();

    res.status(200).json({
      success: true,
      message: "Candidate profile updated successfully.",
      data: profile,
    });
  } catch (error) {
    console.error("Candidate profile update error:", error);
    res.status(500).json({
      success: false,
      message: "Your details could not be saved right now. Please try again.",
      error: (error as Error).message,
    });
  }
};
