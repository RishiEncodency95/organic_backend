import mongoose, { Schema, Document } from "mongoose";

export interface IApplicationEvent extends Document {
  applicationId: string;
  oldStatus?: string;
  newStatus: string;
  changedBy?: string;
  note?: string;
  createdAt: Date;
}

const ApplicationEventSchema: Schema = new Schema(
  {
    applicationId: { type: String, required: true, index: true },
    oldStatus: { type: String },
    newStatus: { type: String, required: true },
    changedBy: { type: String, default: "System" },
    note: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export default mongoose.models.ApplicationEvent ||
  mongoose.model<IApplicationEvent>("ApplicationEvent", ApplicationEventSchema);
