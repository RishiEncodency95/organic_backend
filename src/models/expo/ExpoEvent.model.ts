import mongoose, { Schema, Document } from "mongoose";

export interface IPaymentPlan {
  id: string;
  label: string;
  percentage: number;
}

/** An expo edition exhibitors can book stalls for (e.g. Bharat Organic Expo 2027). */
export interface IExpoEvent extends Document {
  name: string;
  startDate: Date;
  endDate: Date;
  venue: string;
  city: string;
  isActive: boolean;
  paymentPlans: IPaymentPlan[];
  createdAt: Date;
  updatedAt: Date;
}

const PaymentPlanSchema = new Schema<IPaymentPlan>(
  {
    id: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    percentage: { type: Number, required: true, min: 1, max: 100 },
  },
  { _id: false }
);

const ExpoEventSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    venue: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    // Only active events are offered on the Book a Stand page.
    isActive: { type: Boolean, default: true, index: true },
    paymentPlans: { type: [PaymentPlanSchema], default: [{ id: "full", label: "Full Payment", percentage: 100 }] },
  },
  { timestamps: true }
);

export default mongoose.models.ExpoEvent || mongoose.model<IExpoEvent>("ExpoEvent", ExpoEventSchema);
