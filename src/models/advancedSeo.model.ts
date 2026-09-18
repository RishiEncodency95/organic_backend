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

export interface IAdvancedSeo extends Document {
  headerScripts: string;
  footerScripts: string;
  seoFiles: ISeoFile[];
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
    updatedBy: { type: String, default: "Admin User" },
  },
  { timestamps: true }
);

const AdvancedSeo =
  mongoose.models.AdvancedSeo || mongoose.model<IAdvancedSeo>("AdvancedSeo", advancedSeoSchema);

export default AdvancedSeo;
