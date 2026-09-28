import { Request, Response } from "express";
import mongoose from "mongoose";
import UdyamVerification from "../../models/msme/UdyamVerification.model";
import { uploadUdyamCertificateToCloudinary } from "../../services/cloudinary.service";
import { runUdyamExtractionPipeline } from "../../services/ai/udyamExtraction.service";

const MAX_UDYAM_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIMES = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "application/octet-stream"];

/**
 * Single-shot: upload the certificate to Cloudinary, then read it with AI, then
 * return everything the eligibility-check UI needs. Unlike the careers CV flow this
 * doesn't need a separate "analyze" step — there's no job to match against yet.
 */
export const analyzeUdyamCertificate = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file || (req.files && Array.isArray(req.files) ? req.files[0] : undefined);

    if (!file) {
      res.status(400).json({ success: false, message: "No file was uploaded." });
      return;
    }
    if (!ALLOWED_MIMES.includes(file.mimetype) || !/\.(pdf|jpe?g|png)$/i.test(file.originalname)) {
      res.status(400).json({ success: false, message: "Only PDF, JPG, and PNG files are allowed." });
      return;
    }
    if (file.size > MAX_UDYAM_BYTES) {
      res.status(400).json({ success: false, message: "File is larger than 5 MB." });
      return;
    }

    const uploadResult = await uploadUdyamCertificateToCloudinary(file.buffer, file.originalname, file.mimetype);

    let record;
    try {
      const { data, provider } = await runUdyamExtractionPipeline(file.buffer, file.mimetype, file.originalname);

      record = await UdyamVerification.create({
        cloudinaryUrl: uploadResult.url,
        cloudinaryPublicId: uploadResult.publicId,
        originalFileName: uploadResult.originalFileName,
        fileType: uploadResult.format,
        fileSize: uploadResult.bytes,
        provider,
        status: "COMPLETED",
        extractedData: data,
      });
    } catch (extractErr) {
      console.error("Udyam extraction pipeline error:", extractErr);
      record = await UdyamVerification.create({
        cloudinaryUrl: uploadResult.url,
        cloudinaryPublicId: uploadResult.publicId,
        originalFileName: uploadResult.originalFileName,
        fileType: uploadResult.format,
        fileSize: uploadResult.bytes,
        provider: "Heuristic",
        status: "FAILED",
        extractedData: {
          documentType: "unclear",
          udyamRegistrationNumber: null,
          enterpriseName: null,
          enterpriseType: null,
          majorActivity: null,
          socialCategory: null,
          gender: null,
          dateOfIncorporation: null,
          dateOfUdyamRegistration: null,
          address: null,
          state: null,
          district: null,
          pincode: null,
          mobile: null,
          email: null,
          nicCode: null,
          gstin: null,
          pan: null,
          constitution: null,
          bankName: null,
          bankIfsc: null,
          bankAccountNumber: null,
        },
        error: (extractErr as Error).message,
      });
    }

    res.status(200).json({
      success: true,
      message: "Certificate uploaded and analyzed.",
      data: {
        verificationId: record._id,
        cloudinaryUrl: record.cloudinaryUrl,
        status: record.status,
        provider: record.provider,
        extractedData: record.extractedData,
      },
    });
  } catch (error) {
    console.error("Analyze Udyam certificate error:", error);
    res.status(500).json({
      success: false,
      message: "Could not process the certificate. Please try again.",
      error: (error as Error).message,
    });
  }
};

/**
 * Returns a saved certificate reading by id. The apply form pre-fills from this rather
 * than from anything the browser kept, so the stored reading stays the single source of
 * truth — a copy in localStorage can be stale, hand-edited, or missing entirely after a
 * device switch, and the form locks these fields against editing on the strength of it.
 */
export const getUdyamVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid verification id." });
      return;
    }

    const record = await UdyamVerification.findById(id).lean();
    if (!record) {
      res.status(404).json({ success: false, message: "Certificate reading not found." });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        verificationId: record._id,
        status: record.status,
        provider: record.provider,
        extractedData: record.extractedData,
      },
    });
  } catch (error) {
    console.error("Get Udyam verification error:", error);
    res.status(500).json({
      success: false,
      message: "Could not load the certificate reading. Please try again.",
    });
  }
};
