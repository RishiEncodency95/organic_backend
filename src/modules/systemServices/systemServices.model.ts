import mongoose, { Schema, Document } from "mongoose";

export type ExternalServiceCategory =
  | "DOMAIN"
  | "HOSTING"
  | "SSL_CERTIFICATE"
  | "PAYMENT_GATEWAY"
  | "EMAIL_SMTP"
  | "SMS_WHATSAPP"
  | "MEDIA_STORAGE"
  | "AI_API"
  | "ANALYTICS"
  | "DATABASE"
  | "CDN"
  | "SOFTWARE_LICENSE"
  | "SOCIAL_MEDIA"
  | "API_SERVICE"
  | "OTHER";

export type ExternalServiceBillingCycle = "ONE_TIME" | "MONTHLY" | "YEARLY";

export interface IExternalServiceReceipt {
  url: string;
  label?: string;
  uploadedAt: string;
}

export interface IExternalService extends Document {
  category: ExternalServiceCategory;
  name: string;
  provider?: string;
  accountIdentifier?: string;
  loginUrl?: string;
  secretLabel?: string;
  secretValue?: string;
  startDate?: string;
  expiryDate: string;
  autoRenews?: boolean;
  notes?: string;
  details?: Record<string, string>;
  popupReminderDays?: number;
  emailReminderDays?: number;
  notifyEmails?: string[];
  remindersEnabled: boolean;
  pricingType: "FREE" | "PAID";
  costAmount?: number;
  currency?: string;
  billingCycle?: ExternalServiceBillingCycle;
  receipts: IExternalServiceReceipt[];
  createdAt: Date;
  updatedAt: Date;
}

const externalServiceSchema = new Schema<IExternalService>(
  {
    category: {
      type: String,
      required: true,
      enum: [
        "DOMAIN",
        "HOSTING",
        "SSL_CERTIFICATE",
        "PAYMENT_GATEWAY",
        "EMAIL_SMTP",
        "SMS_WHATSAPP",
        "MEDIA_STORAGE",
        "AI_API",
        "ANALYTICS",
        "DATABASE",
        "CDN",
        "SOFTWARE_LICENSE",
        "SOCIAL_MEDIA",
        "API_SERVICE",
        "OTHER",
      ],
    },
    name: { type: String, required: true },
    provider: { type: String },
    accountIdentifier: { type: String },
    loginUrl: { type: String },
    secretLabel: { type: String },
    secretValue: { type: String },
    startDate: { type: String },
    expiryDate: { type: String, required: true },
    autoRenews: { type: Boolean, default: false },
    notes: { type: String },
    details: { type: Map, of: String },
    popupReminderDays: { type: Number },
    emailReminderDays: { type: Number },
    notifyEmails: [{ type: String }],
    remindersEnabled: { type: Boolean, default: true },
    pricingType: { type: String, enum: ["FREE", "PAID"], default: "PAID" },
    costAmount: { type: Number },
    currency: { type: String, default: "INR" },
    billingCycle: { type: String, enum: ["ONE_TIME", "MONTHLY", "YEARLY"] },
    receipts: [
      {
        url: { type: String, required: true },
        label: { type: String },
        uploadedAt: { type: String, default: () => new Date().toISOString() },
      },
    ],
  },
  { timestamps: true }
);

export const ExternalService = mongoose.model<IExternalService>(
  "ExternalService",
  externalServiceSchema
);
