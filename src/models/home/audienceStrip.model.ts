import mongoose, { Document, Schema } from "mongoose";

export interface IAudienceStripItem {
  title: string;
  subtitle: string;
  label?: string;
  icon: string;
  color: string;
  order?: number;
}

export interface IAudienceStrip extends Document {
  enabled: boolean;
  items: IAudienceStripItem[];
  createdAt: Date;
  updatedAt: Date;
}

const audienceStripItemSchema = new Schema<IAudienceStripItem>(
  {
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    label: { type: String, default: "" },
    icon: { type: String, default: "GraduationCap" },
    color: { type: String, default: "text-orange-500" },
    order: { type: Number, default: 0 },
  },
  { _id: true }
);

const audienceStripSchema = new Schema<IAudienceStrip>(
  {
    enabled: { type: Boolean, default: true },
    items: [audienceStripItemSchema],
  },
  { timestamps: true }
);

const AudienceStrip = mongoose.model<IAudienceStrip>(
  "OrganicAudienceStrip",
  audienceStripSchema
);

export default AudienceStrip;
