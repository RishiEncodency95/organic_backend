import mongoose, { Schema } from "mongoose";

/**
 * Stand bookings from the website's /registration/book-a-stand page.
 *   category: domestic (India, INR) | international (outside India, USD)
 * Saved before payment (paymentStatus "pending"); verify-payment marks it "paid" and books
 * the stall. `status` is the admin's own workflow on top of that.
 */
export const EXHIBITOR_CATEGORIES = ["domestic", "international"] as const;
export const EXHIBITOR_STATUSES = ["pending", "confirmed", "cancelled"] as const;
export const EXHIBITOR_PAYMENT_STATUSES = ["pending", "paid", "failed"] as const;

const contactSchema = new Schema(
  {
    title: { type: String, default: "" },
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    email: { type: String, default: "", lowercase: true, trim: true },
    designation: { type: String, default: "" },
    mobile: { type: String, default: "" },
    alternateNo: { type: String, default: "" },
  },
  { _id: false }
);

const exhibitorRegistrationSchema = new Schema(
  {
    registrationNo: { type: String, required: true, unique: true, index: true },
    category: { type: String, enum: EXHIBITOR_CATEGORIES, required: true, index: true },
    event: { type: Schema.Types.ObjectId, ref: "ExpoEvent" },
    eventName: { type: String, default: "" },

    exhibitorName: { type: String, required: true, trim: true },
    fasciaName: { type: String, default: "", trim: true },
    typeOfBusiness: { type: String, default: "" },
    natureOfBusiness: { type: String, default: "" },
    industrySector: { type: String, default: "" },
    website: { type: String, default: "" },
    address: { type: String, default: "" },
    country: { type: String, default: "" },
    state: { type: String, default: "" },
    city: { type: String, default: "" },
    pincode: { type: String, default: "" },
    gstNo: { type: String, default: "" },
    panNo: { type: String, default: "" },

    contact1: { type: contactSchema, default: () => ({}) },
    contact2: { type: contactSchema, default: () => ({}) },

    // The stall as it was when booked
    stall: { type: Schema.Types.ObjectId, ref: "Stall" },
    stallNumber: { type: String, default: "" },
    hall: { type: String, default: "" },
    stallType: { type: String, default: "" },
    stallArea: { type: Number, default: 0 },
    plScheme: { type: String, default: "" },
    currency: { type: String, enum: ["INR", "USD"], default: "INR" },
    ratePerSqm: { type: Number, default: 0 },

    // Amounts worked out on the server (see exhibitorRegistration.service.ts → priceFor)
    finance: { type: Schema.Types.Mixed, default: {} },
    paymentPlanId: { type: String, default: "full" },
    paymentPlanLabel: { type: String, default: "Full Payment" },
    netPayable: { type: Number, default: 0 },
    amountDueNow: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balanceAmount: { type: Number, default: 0 },

    paymentStatus: { type: String, enum: EXHIBITOR_PAYMENT_STATUSES, default: "pending", index: true },
    razorpayOrderId: { type: String, default: "" },
    razorpayPaymentId: { type: String, default: "" },
    paidAt: { type: Date },
    // Paid, but someone else got the stall first — admin has to allot another one
    stallConflict: { type: Boolean, default: false },

    status: { type: String, enum: EXHIBITOR_STATUSES, default: "pending", index: true },
    statusUpdatedBy: { type: String, default: "" },
    statusUpdatedAt: { type: Date },

    // Everything else the exhibitor filled (sectors, referral, etc.) for the admin overview
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export default mongoose.models.ExhibitorRegistration ||
  mongoose.model("ExhibitorRegistration", exhibitorRegistrationSchema);
