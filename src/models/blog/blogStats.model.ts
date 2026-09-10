import mongoose, { Schema, Document } from "mongoose";

export interface IBlogStats extends Document {
  stats?: Array<{
    icon?: string;
    value?: number;
    suffix?: string;
    label?: string;
  }>;
}

const BlogStatsSchema = new Schema<IBlogStats>(
  {
    stats: [
      {
        icon: { type: String },
        value: { type: Number },
        suffix: { type: String },
        label: { type: String },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model<IBlogStats>("BlogStats", BlogStatsSchema);
