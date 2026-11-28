import mongoose, { Schema, Document } from "mongoose";

export interface IPageViewEvent extends Document {
  sessionId: string;
  visitorId: string;
  path: string;
  title?: string;
  referrer?: string;
  userAgent?: string;
  country?: string;
  city?: string;
  deviceType?: "desktop" | "mobile" | "tablet" | "unknown";
  durationSeconds: number;
  bounced: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const pageViewEventSchema = new Schema<IPageViewEvent>(
  {
    sessionId: { type: String, required: true, trim: true, index: true },
    visitorId: { type: String, required: true, trim: true, index: true },
    path: { type: String, required: true, trim: true, default: "/", index: true },
    title: { type: String, trim: true, maxlength: 300 },
    referrer: { type: String, trim: true, maxlength: 500 },
    userAgent: { type: String, trim: true, maxlength: 500 },
    country: { type: String, trim: true, maxlength: 80 },
    city: { type: String, trim: true, maxlength: 120 },
    deviceType: {
      type: String,
      enum: ["desktop", "mobile", "tablet", "unknown"],
      default: "unknown",
    },
    durationSeconds: { type: Number, default: 0, min: 0 },
    bounced: { type: Boolean, default: true },
  },
  { timestamps: true }
);

pageViewEventSchema.index({ createdAt: -1 });
pageViewEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

export const PageViewEvent =
  mongoose.models.PageViewEvent ||
  mongoose.model<IPageViewEvent>("PageViewEvent", pageViewEventSchema);

