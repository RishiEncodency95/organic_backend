import mongoose, { Schema, Document } from "mongoose";

export type MsmeApplicationStatus =
  | "DRAFT"
  | "ENTERPRISE_SAVED"
  | "PARTICIPATION_SAVED"
  | "PAYMENT_PENDING"
  | "PAYMENT_FAILED"
  | "SUBMITTED";

interface IBankDetails {
  accountHolderName?: string;
  accountNumber?: string;
  ifsc?: string;
  bankName?: string;
  branch?: string;
}

interface IEnterpriseDetails {
  udyamNumber?: string;
  enterpriseName?: string;
  enterpriseType?: string;
  majorActivity?: string;
  constitution?: string;
  category?: string;
  gender?: string;
  dateOfIncorporation?: string;
  address?: string;
  state?: string;
  district?: string;
  pincode?: string;
  gstin?: string;
  pan?: string;
  bank?: IBankDetails;
  mobile?: string;
  email?: string;
  verifiedMobile?: string;
  verifiedEmail?: string;
}

interface IContactPerson {
  name?: string;
  designation?: string;
  mobile?: string;
  email?: string;
  verifiedMobile?: string;
  verifiedEmail?: string;
}

interface IParticipationDetails {
  stallType?: string;
  stallSize?: string;
  stallLocation?: string;
  contactPerson?: IContactPerson;
}

interface IEligibilitySnapshot {
  checked: boolean;
  eligible?: boolean;
  category?: string;
  supportPercentage?: number;
  checkedAt?: Date;
}

interface IPaymentDetails {
  amount?: number;
  currency?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  status?: "PENDING" | "PAID" | "FAILED";
  paidAt?: Date;
}

export type MsmeReviewStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "NEEDS_INFO";

export interface IMsmeApplication extends Document {
  applicationId: string; // e.g. MSME2026-000001
  status: MsmeApplicationStatus;
  eligibility: IEligibilitySnapshot;
  enterprise: IEnterpriseDetails;
  participation: IParticipationDetails;
  payment: IPaymentDetails;
  /** Staff review of a SUBMITTED application — separate from the lifecycle `status` above. */
  reviewStatus?: MsmeReviewStatus;
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BankDetailsSchema = new Schema<IBankDetails>(
  {
    accountHolderName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    ifsc: { type: String, trim: true, uppercase: true },
    bankName: { type: String, trim: true },
    branch: { type: String, trim: true },
  },
  { _id: false }
);

const EnterpriseDetailsSchema = new Schema<IEnterpriseDetails>(
  {
    udyamNumber: { type: String, trim: true, uppercase: true },
    enterpriseName: { type: String, trim: true },
    enterpriseType: { type: String, trim: true },
    majorActivity: { type: String, trim: true },
    constitution: { type: String, trim: true },
    category: { type: String, trim: true },
    gender: { type: String, trim: true },
    dateOfIncorporation: { type: String, trim: true },
    address: { type: String, trim: true },
    state: { type: String, trim: true },
    district: { type: String, trim: true },
    pincode: { type: String, trim: true },
    gstin: { type: String, trim: true, uppercase: true },
    pan: { type: String, trim: true, uppercase: true },
    bank: { type: BankDetailsSchema, default: undefined },
    mobile: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    verifiedMobile: { type: String, trim: true },
    verifiedEmail: { type: String, trim: true, lowercase: true },
  },
  { _id: false }
);

const ContactPersonSchema = new Schema<IContactPerson>(
  {
    name: { type: String, trim: true },
    designation: { type: String, trim: true },
    mobile: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    verifiedMobile: { type: String, trim: true },
    verifiedEmail: { type: String, trim: true, lowercase: true },
  },
  { _id: false }
);

const ParticipationDetailsSchema = new Schema<IParticipationDetails>(
  {
    stallType: { type: String, trim: true },
    stallSize: { type: String, trim: true },
    stallLocation: { type: String, trim: true },
    contactPerson: { type: ContactPersonSchema, default: undefined },
  },
  { _id: false }
);

const EligibilitySnapshotSchema = new Schema<IEligibilitySnapshot>(
  {
    checked: { type: Boolean, default: false },
    eligible: { type: Boolean },
    category: { type: String, trim: true },
    supportPercentage: { type: Number },
    checkedAt: { type: Date },
  },
  { _id: false }
);

const PaymentDetailsSchema = new Schema<IPaymentDetails>(
  {
    amount: { type: Number },
    currency: { type: String, default: "INR" },
    razorpayOrderId: { type: String, trim: true },
    razorpayPaymentId: { type: String, trim: true },
    razorpaySignature: { type: String, trim: true },
    status: { type: String, enum: ["PENDING", "PAID", "FAILED"] },
    paidAt: { type: Date },
  },
  { _id: false }
);

const MsmeApplicationSchema: Schema = new Schema(
  {
    applicationId: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: [
        "DRAFT",
        "ENTERPRISE_SAVED",
        "PARTICIPATION_SAVED",
        "PAYMENT_PENDING",
        "PAYMENT_FAILED",
        "SUBMITTED",
      ],
      default: "DRAFT",
      index: true,
    },
    eligibility: { type: EligibilitySnapshotSchema, default: () => ({ checked: false }) },
    enterprise: { type: EnterpriseDetailsSchema, default: () => ({}) },
    participation: { type: ParticipationDetailsSchema, default: () => ({}) },
    payment: { type: PaymentDetailsSchema, default: () => ({}) },
    reviewStatus: {
      type: String,
      enum: ["PENDING_REVIEW", "APPROVED", "REJECTED", "NEEDS_INFO"],
    },
    reviewNote: { type: String, trim: true },
    reviewedBy: { type: String, trim: true },
    reviewedAt: { type: Date },
    submittedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.MsmeApplication ||
  mongoose.model<IMsmeApplication>("MsmeApplication", MsmeApplicationSchema);
