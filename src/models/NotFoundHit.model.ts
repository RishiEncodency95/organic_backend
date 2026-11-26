import mongoose, { Document, Schema } from "mongoose";

/** One row per distinct missing path: how often it was hit and from which referrers (reported by the website / edge). */
export interface INotFoundHit extends Document {
  path: string;
  hits: number;
  referrers: Array<{ referrer: string; count: number; lastSeenAt: Date }>;
  firstSeenAt: Date;
  lastSeenAt: Date;
  /** Set once a redirect was created for it */
  redirectId?: mongoose.Types.ObjectId;
  resolvedTo?: string;
  resolvedBy?: string;
  status: "open" | "redirected" | "ignored";
}

const schema = new Schema<INotFoundHit>(
  {
    path: { type: String, required: true, unique: true, trim: true, maxlength: 512 },
    hits: { type: Number, default: 1 },
    referrers: {
      type: [{ referrer: { type: String, maxlength: 512 }, count: { type: Number, default: 1 }, lastSeenAt: { type: Date, default: Date.now }, _id: false }],
      default: [],
    },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now, index: true },
    redirectId: { type: Schema.Types.ObjectId },
    resolvedTo: { type: String },
    resolvedBy: { type: String },
    status: { type: String, enum: ["open", "redirected", "ignored"], default: "open", index: true },
  },
  { timestamps: true }
);
schema.index({ status: 1, hits: -1 });

const NotFoundHit = mongoose.models.NotFoundHit || mongoose.model<INotFoundHit>("NotFoundHit", schema);
export default NotFoundHit;
