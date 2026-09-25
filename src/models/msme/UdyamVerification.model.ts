import mongoose, { Schema, Document } from "mongoose";

export interface IUdyamVerification extends Document {
  cloudinaryUrl: string;
  cloudinaryPublicId: string;
  originalFileName: string;
  fileType: string;
  fileSize: number;
  provider: "OpenAI" | "Gemini" | "Heuristic";
  status: "COMPLETED" | "FAILED";
  extractedData: {
    documentType: "valid_udyam_certificate" | "unclear" | "not_a_udyam_certificate";
    udyamRegistrationNumber: string | null;
    enterpriseName: string | null;
    enterpriseType: string | null;
    majorActivity: string | null;
    socialCategory: string | null;
    gender: string | null;
    dateOfIncorporation: string | null;
    dateOfUdyamRegistration: string | null;
    address: string | null;
    state: string | null;
    district: string | null;
    pincode: string | null;
    mobile: string | null;
    email: string | null;
    nicCode: string | null;
  };
  error?: string;
  createdAt: Date;
}

const UdyamVerificationSchema: Schema = new Schema(
  {
    cloudinaryUrl: { type: String, required: true },
    cloudinaryPublicId: { type: String, required: true },
    originalFileName: { type: String, required: true },
    fileType: { type: String },
    fileSize: { type: Number },
    provider: { type: String, enum: ["OpenAI", "Gemini", "Heuristic"], default: "OpenAI" },
    status: { type: String, enum: ["COMPLETED", "FAILED"], default: "COMPLETED" },
    extractedData: { type: Schema.Types.Mixed },
    error: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export default mongoose.models.UdyamVerification ||
  mongoose.model<IUdyamVerification>("UdyamVerification", UdyamVerificationSchema);
