import mongoose, { Schema, Document, Types } from "mongoose";

export const STALL_CURRENCIES = ["INR", "USD"] as const;

/** Price per sq m for one stall type of an event, in one currency. */
export interface IStallRate extends Document {
  event: Types.ObjectId;
  stallType: string;
  currency: (typeof STALL_CURRENCIES)[number];
  ratePerSqm: number;
  createdAt: Date;
  updatedAt: Date;
}

const StallRateSchema: Schema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: "ExpoEvent", required: true, index: true },
    stallType: { type: String, required: true, trim: true },
    currency: { type: String, enum: STALL_CURRENCIES, required: true },
    ratePerSqm: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

StallRateSchema.index({ event: 1, stallType: 1, currency: 1 }, { unique: true });

export default mongoose.models.StallRate || mongoose.model<IStallRate>("StallRate", StallRateSchema);
