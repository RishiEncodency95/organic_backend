import mongoose, { Schema, Document, Types } from "mongoose";

export const STALL_STATUSES = ["available", "reserved", "booked", "blocked"] as const;
export type StallStatus = (typeof STALL_STATUSES)[number];

/**
 * A bookable stall of one expo event. `area` is length × width in sq m.
 * stallType and plScheme hold values of the "exhibitor-stall-type" and
 * "stall-pl-scheme" dropdown lists.
 */
export interface IStall extends Document {
  event: Types.ObjectId;
  stallNumber: string;
  hall: string;
  stallType: string;
  length: number;
  width: number;
  area: number;
  plScheme: string;
  incrementPercentage: number;
  discountPercentage: number;
  status: StallStatus;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const StallSchema: Schema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: "ExpoEvent", required: true, index: true },
    stallNumber: { type: String, required: true, trim: true, maxlength: 30 },
    hall: { type: String, default: "", trim: true },
    stallType: { type: String, required: true, trim: true },
    length: { type: Number, required: true, min: 0.5 },
    width: { type: Number, required: true, min: 0.5 },
    area: { type: Number, required: true, min: 0 },
    plScheme: { type: String, default: "One Side Open", trim: true },
    // Preferential-location surcharge and stall-specific discount, in percent.
    incrementPercentage: { type: Number, default: 0, min: 0, max: 100 },
    discountPercentage: { type: Number, default: 0, min: 0, max: 100 },
    status: { type: String, enum: STALL_STATUSES, default: "available", index: true },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

StallSchema.index({ event: 1, stallNumber: 1 }, { unique: true });

export default mongoose.models.Stall || mongoose.model<IStall>("Stall", StallSchema);
