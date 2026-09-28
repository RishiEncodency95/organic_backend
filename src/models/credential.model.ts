import mongoose, { Schema, Document } from "mongoose";

export interface ICredential extends Document {
  category: string;
  name: string;
  provider?: string;
  accountIdentifier?: string;
  loginUrl?: string;
  secretLabel?: string;
  secretValue?: string;
  startDate?: Date;
  expiryDate?: Date;
  autoRenews: boolean;
  notes?: string;
  popupReminderDays?: number;
  emailReminderDays?: number;
  notifyEmails?: string[];
  remindersEnabled: boolean;
  pricingType: "FREE" | "PAID";
  costAmount?: number;
  currency: string;
  billingCycle?: "MONTHLY" | "YEARLY" | "ONE_TIME";
  details?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const CredentialSchema = new Schema(
  {
    category: { type: String, required: true },
    name: { type: String, required: true },
    provider: { type: String },
    accountIdentifier: { type: String },
    loginUrl: { type: String },
    secretLabel: { type: String },
    secretValue: { type: String },
    startDate: { type: Date },
    expiryDate: { type: Date },
    autoRenews: { type: Boolean, default: false },
    notes: { type: String },
    popupReminderDays: { type: Number },
    emailReminderDays: { type: Number },
    notifyEmails: [{ type: String }],
    remindersEnabled: { type: Boolean, default: true },
    pricingType: { type: String, enum: ["FREE", "PAID"], default: "PAID" },
    costAmount: { type: Number },
    currency: { type: String, default: "INR" },
    billingCycle: { type: String, enum: ["MONTHLY", "YEARLY", "ONE_TIME"] },
    details: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export default mongoose.model<ICredential>("Credential", CredentialSchema);
