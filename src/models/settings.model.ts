import mongoose, { Document, Schema } from "mongoose";

export interface ISettings extends Document {
  website: string;
  data: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new Schema<ISettings>(
  {
    website: {
      type: String,
      required: true,
      unique: true,
      default: "Organicexpo",
      index: true,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

export default mongoose.models.Settings || mongoose.model<ISettings>("Settings", settingsSchema);
