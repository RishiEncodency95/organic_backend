import mongoose, { Schema, Document } from "mongoose";

export interface IEmailLog extends Document {
  recipient: string;
  subject: string;
  template: string;
  status: "QUEUED" | "SENT" | "FAILED";
  error?: string;
  sentAt?: Date;
  createdAt: Date;
}

const EmailLogSchema: Schema = new Schema(
  {
    recipient: { type: String, required: true },
    subject: { type: String, required: true },
    template: { type: String, required: true },
    status: { type: String, enum: ["QUEUED", "SENT", "FAILED"], default: "QUEUED" },
    error: { type: String },
    sentAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.EmailLog ||
  mongoose.model<IEmailLog>("EmailLog", EmailLogSchema);
