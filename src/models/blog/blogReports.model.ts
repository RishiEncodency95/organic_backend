import mongoose, { Schema, Document } from "mongoose";

export interface IBlogReports extends Document {
  title?: string;
  actionText?: string;
  reports?: Array<{
    title?: string;
    meta?: string;
  }>;
}

const BlogReportsSchema = new Schema<IBlogReports>(
  {
    title: { type: String },
    actionText: { type: String },
    reports: [
      {
        title: { type: String },
        meta: { type: String },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model<IBlogReports>("BlogReports", BlogReportsSchema);
