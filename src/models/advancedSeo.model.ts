import mongoose, { Document, Schema } from "mongoose";

export interface ISeoFile {
  _id?: any;
  originalName: string;
  fileName: string;
  filePath: string;
  fileType: string;
  size: number;
  uploadedAt: Date;
}

export interface ISocialLinks {
  facebook: string;
  instagram: string;
  twitter: string;
  youtube: string;
  linkedin: string;
}

export interface IAdvancedSeo extends Document {
  headerScripts: string;
  footerScripts: string;
  seoFiles: ISeoFile[];
  socialLinks: ISocialLinks;
  ga4MeasurementId?: string;
  gtmContainerId?: string;
  googleSearchConsoleVerification?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const seoFileSchema = new Schema<ISeoFile>({
  originalName: { type: String, required: true },
  fileName: { type: String, required: true },
  filePath: { type: String, required: true },
  fileType: { type: String, required: true },
  size: { type: Number, default: 0 },
  uploadedAt: { type: Date, default: Date.now },
});

const advancedSeoSchema = new Schema<IAdvancedSeo>(
  {
    headerScripts: { type: String, default: "" },
    footerScripts: { type: String, default: "" },
    seoFiles: { type: [seoFileSchema], default: [] },
    ga4MeasurementId: { type: String, default: "G-PP5N4MZBL9" },
    gtmContainerId: { type: String, default: "GTM-TG73QDSZ" },
    googleSearchConsoleVerification: {
      type: String,
      default: "LSfGa6XOQVOXKM-Z4Xq_8JK-j6DRfoxnR-QFCnzsXQU",
    },
    socialLinks: {
      facebook: {
        type: String,
        default: "https://www.facebook.com/bharatorganicexpo",
      },
      instagram: {
        type: String,
        default: "https://www.instagram.com/bharatorganicexpo",
      },
      twitter: {
        type: String,
        default: "https://x.com/organicexpoin",
      },
      youtube: {
        type: String,
        default: "https://www.youtube.com/@bharatorganicexpo",
      },
      linkedin: {
        type: String,
        default: "https://www.linkedin.com/company/bharatorganicexpo/",
      },
    },
    updatedBy: { type: String, default: "Admin User" },
  },
  { timestamps: true }
);

const AdvancedSeo =
  mongoose.models.AdvancedSeo || mongoose.model<IAdvancedSeo>("AdvancedSeo", advancedSeoSchema);

export default AdvancedSeo;

