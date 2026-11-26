import mongoose, { Document, Schema } from "mongoose";
import { isValidFromPath, isValidToTarget } from "../modules/seoAudit/redirectsExport";

export interface IRedirect extends Document {
  fromUrl: string;
  toUrl: string;
  statusCode: number;
  isActive: boolean;
  hits: number;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const redirectSchema = new Schema<IRedirect>(
  {
    fromUrl: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
      validate: { validator: isValidFromPath, message: "fromUrl must be a plain path (no wildcards, placeholders, query or spaces)" },
    },
    toUrl: {
      type: String,
      required: true,
      trim: true,
      validate: { validator: isValidToTarget, message: "toUrl is not a valid redirect target" },
    },
    statusCode: {
      type: Number,
      default: 301,
      enum: [301, 302, 307, 308],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    hits: {
      type: Number,
      default: 0,
    },
    lastUsedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

redirectSchema.index({ fromUrl: 1, isActive: 1 });

const Redirect =
  mongoose.models.Redirect || mongoose.model<IRedirect>("Redirect", redirectSchema);

export default Redirect;
