import mongoose, { Schema } from "mongoose";

/*
 * A nomination for the Advisory Board, from the website form /about/nominate_advisory_board.
 * The nominee is the person proposed for the board; the nominator is whoever fills the form
 * (the same person when the relationship is "Self").
 */

export const ADVISORY_NOMINATION_STATUSES = ["pending", "shortlisted", "approved", "rejected"] as const;

const personSchema = {
  name: { type: String, required: true, trim: true },
  designation: { type: String, required: true, trim: true },
  organisation: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, required: true, trim: true },
};

const advisoryNominationSchema = new Schema(
  {
    nominee: {
      ...personSchema,
      industry: { type: String, required: true, trim: true },
      linkedin: { type: String, default: "", trim: true },
    },
    expertiseArea: { type: String, required: true, trim: true },
    achievements: { type: String, required: true, trim: true },
    reason: { type: String, required: true, trim: true },
    nominator: personSchema,
    relationship: { type: String, required: true, trim: true },
    /** The nominee nominated themselves */
    selfNomination: { type: Boolean, default: false },
    additionalInfo: { type: String, default: "", trim: true },
    declaration: { type: Boolean, required: true },
    eventName: { type: String, default: "BOE2027", trim: true },
    status: { type: String, enum: ADVISORY_NOMINATION_STATUSES, default: "pending", index: true },
    /** Internal note from the team (not shown to the nominee) */
    adminNote: { type: String, default: "", trim: true },
    statusUpdatedBy: { type: String, default: "", trim: true },
    statusUpdatedAt: { type: Date },
  },
  { timestamps: true }
);

advisoryNominationSchema.index({ "nominee.email": 1, createdAt: -1 });
advisoryNominationSchema.index({ "nominee.phone": 1, createdAt: -1 });

const AdvisoryNomination = mongoose.model("OrganicAdvisoryNomination", advisoryNominationSchema);
export default AdvisoryNomination;
