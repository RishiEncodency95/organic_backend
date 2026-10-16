import mongoose, { Document, Schema } from "mongoose";

export interface IBacklink extends Document {
  targetUrl: string;
  sourceUrl: string;
  anchorText?: string;
  type: "dofollow" | "nofollow";
  daScore?: number;
  status: "active" | "lost" | "broken";
  notes?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const backlinkSchema = new Schema<IBacklink>(
  {
    targetUrl: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    sourceUrl: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    anchorText: {
      type: String,
      trim: true,
      default: "",
    },
    type: {
      type: String,
      enum: ["dofollow", "nofollow"],
      default: "dofollow",
    },
    daScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "lost", "broken"],
      default: "active",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    createdBy: {
      type: String,
      trim: true,
      default: "Admin",
    },
  },
  {
    timestamps: true,
  }
);

export const Backlink = mongoose.model<IBacklink>("Backlink", backlinkSchema);
