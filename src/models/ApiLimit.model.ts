import mongoose, { Schema } from "mongoose";

/*
 * IP Block Limits (admin: Careers & Applications → IP Block Limits).
 *
 * Each protected website API (resume upload, enquiry forms, registrations, OTPs… see
 * modules/apiLimits/apiLimits.registry.ts) has a rule: one IP may make `maxAttempts`
 * accepted requests within `blockHours`; the next attempt blocks that IP on that API for
 * `blockHours`. A block ends by itself or when an admin unblocks it; the count then starts
 * again from zero.
 */

const ruleSchema = new Schema(
  {
    key: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    maxAttempts: { type: Number, min: 1, max: 1000 },
    blockHours: { type: Number, min: 1, max: 720 },
  },
  { _id: false }
);

/** Admin overrides of the registry defaults, one entry per API key. */
const apiLimitSettingsSchema = new Schema(
  {
    key: { type: String, default: "default", unique: true },
    rules: { type: [ruleSchema], default: [] },
  },
  { timestamps: true }
);

/** One accepted request to a protected API from an IP (kept 60 days). */
const apiAttemptSchema = new Schema(
  {
    ip: { type: String, required: true },
    api: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
apiAttemptSchema.index({ ip: 1, api: 1, createdAt: -1 });
apiAttemptSchema.index({ api: 1, createdAt: -1 });
apiAttemptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });

/** An IP blocked on one API until `blockedUntil`, or until `liftedAt` if an admin unblocked it (kept 90 days). */
const apiBlockSchema = new Schema(
  {
    ip: { type: String, required: true },
    api: { type: String, required: true },
    path: { type: String },
    blockedUntil: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    /** false for the zero-length rows that only mark where an admin reset the count */
    isBlock: { type: Boolean, default: true },
    liftedAt: { type: Date },
    liftedBy: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
apiBlockSchema.index({ ip: 1, api: 1, createdAt: -1 });
apiBlockSchema.index({ createdAt: -1 });
apiBlockSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const ApiLimitSettings = mongoose.models.ApiLimitSettings || mongoose.model("ApiLimitSettings", apiLimitSettingsSchema);
export const ApiAttempt = mongoose.models.ApiAttempt || mongoose.model("ApiAttempt", apiAttemptSchema);
export const ApiBlock = mongoose.models.ApiBlock || mongoose.model("ApiBlock", apiBlockSchema);
