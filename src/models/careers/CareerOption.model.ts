import mongoose, { Schema, Document } from "mongoose";

// Admin-managed dropdown values shown on the career application form.
export const CAREER_OPTION_TYPES = ["notice_period", "joining_period", "expected_ctc"] as const;
export type CareerOptionType = (typeof CAREER_OPTION_TYPES)[number];

export interface ICareerOption extends Document {
  type: CareerOptionType;
  label: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CareerOptionSchema: Schema = new Schema(
  {
    type: { type: String, enum: CAREER_OPTION_TYPES, required: true, index: true },
    label: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CareerOptionSchema.index({ type: 1, label: 1 }, { unique: true });

export default mongoose.models.CareerOption ||
  mongoose.model<ICareerOption>("CareerOption", CareerOptionSchema);
