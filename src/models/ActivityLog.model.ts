import mongoose, { Schema, Document } from "mongoose";

/**
 * One admin-panel action (create / update / delete / login …), written automatically by
 * activityLog.middleware for every write request made with an admin token. Read-only:
 * nothing in the API edits or deletes a row; rows expire after a year (TTL index).
 */
export const ACTIVITY_ACTIONS = [
  "Created",
  "Updated",
  "Deleted",
  "Uploaded",
  "Published",
  "Restored",
  "Reordered",
  "Imported",
  "Exported",
  "Sent",
  "Login",
  "Logout",
  "Password Changed",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

/** One record the action touched, with its old and new values (see config/activityTracker) */
export interface IActivityChange {
  entity: string;
  entityId?: string;
  operation: "created" | "updated" | "deleted";
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface IActivityLog extends Document {
  userId?: string;
  userName: string;
  userEmail?: string;
  userRole?: string;
  action: ActivityAction;
  module: string;
  /** Admin-panel page the action was made from (e.g. /add-by-admin/dropdowns) */
  url: string;
  method: string;
  /** API endpoint that was called (e.g. /dropdowns/admin/options/66f…) */
  apiPath: string;
  ip: string;
  userAgent?: string;
  status: "Success" | "Failed";
  statusCode: number;
  details: string;
  entityId?: string;
  durationMs?: number;
  changes: IActivityChange[];
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    userId: { type: String, index: true },
    userName: { type: String, required: true, trim: true },
    userEmail: { type: String, trim: true },
    userRole: { type: String, trim: true },
    action: { type: String, enum: ACTIVITY_ACTIONS, required: true, index: true },
    module: { type: String, required: true, trim: true, index: true },
    url: { type: String, default: "" },
    method: { type: String, required: true },
    apiPath: { type: String, required: true },
    ip: { type: String, default: "" },
    userAgent: { type: String },
    status: { type: String, enum: ["Success", "Failed"], required: true, index: true },
    statusCode: { type: Number, required: true },
    details: { type: String, default: "" },
    entityId: { type: String },
    durationMs: { type: Number },
    changes: {
      type: [
        new Schema(
          {
            entity: { type: String, required: true },
            entityId: { type: String },
            operation: { type: String, enum: ["created", "updated", "deleted"], required: true },
            before: { type: Schema.Types.Mixed },
            after: { type: Schema.Types.Mixed },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ActivityLogSchema.index({ createdAt: -1 });
// Keep a year of history
ActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60, name: "activity_ttl" });

export const ActivityLog =
  (mongoose.models.ActivityLog as mongoose.Model<IActivityLog>) || mongoose.model<IActivityLog>("ActivityLog", ActivityLogSchema);
