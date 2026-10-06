import mongoose, { Schema } from "mongoose";

/**
 * Visitor registrations from the website's /registration/visitor-registration page.
 *   - domestic       (subType: corporate | general | healthCamp)
 *   - international
 *   - group          (5–10 people from one organisation; persons[0] is the primary contact)
 * The searchable/listed fields are copied to the top level; everything the visitor filled
 * is kept as-is in `details` for the admin overview.
 */
export const VISITOR_CATEGORIES = ["domestic", "international", "group"] as const;
export const VISITOR_SUBTYPES = ["corporate", "general", "healthCamp"] as const;
export const VISITOR_STATUSES = ["pending", "confirmed", "cancelled"] as const;

const personSchema = new Schema(
  {
    firstName: { type: String, default: "", trim: true },
    lastName: { type: String, default: "", trim: true },
    gender: { type: String, default: "", trim: true },
    designation: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    mobile: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const visitorRegistrationSchema = new Schema(
  {
    registrationNo: { type: String, required: true, unique: true, index: true },
    category: { type: String, enum: VISITOR_CATEGORIES, required: true, index: true },
    subType: { type: String, enum: [...VISITOR_SUBTYPES, ""], default: "" },
    eventName: { type: String, default: "", trim: true },

    name: { type: String, required: true, trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    mobile: { type: String, default: "", trim: true },
    companyName: { type: String, default: "", trim: true },
    designation: { type: String, default: "", trim: true },
    country: { type: String, default: "", trim: true },
    state: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    nationality: { type: String, default: "", trim: true },

    persons: { type: [personSchema], default: [] },
    details: { type: Schema.Types.Mixed, default: {} },

    status: { type: String, enum: VISITOR_STATUSES, default: "pending", index: true },
    statusUpdatedBy: { type: String, default: "" },
    statusUpdatedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.models.VisitorRegistration ||
  mongoose.model("VisitorRegistration", visitorRegistrationSchema);
