import mongoose, { Schema } from "mongoose";

/*
 * Notification Settings (admin): which team and employee get each new enquiry, and the team
 * alerts. One document (key "default"). Applied by modules/chat/enquiryRouting.service.ts.
 */

export const ASSIGNMENT_TYPES = ["Assign in Rotation", "Fixed Employee", "Assign by Topic", "Least Busy"] as const;
export const ASSIGN_DURING = ["Team Working Hours", "Any Time", "Custom Schedule"] as const;
export const WHEN_UNAVAILABLE = ["Use Next Available Employee", "Assign to Backup Owner", "Keep in Queue"] as const;
export const NONE_AVAILABLE = ["Queue for Team Lead", "Assign to Backup Owner", "Notify Admin"] as const;
export const NO_RESPONSE = ["Notify Team Lead", "Notify Backup Owner", "Do Nothing"] as const;
export const REASSIGN_DELAYS = ["Set delay", "30 minutes", "1 hour", "2 hours", "4 hours"] as const;

const ruleSchema = new Schema(
  {
    ruleId: { type: Number, required: true },
    topic: { type: String, trim: true, required: true },
    team: { type: String, trim: true, required: true },
    type: { type: String, enum: ASSIGNMENT_TYPES, default: "Assign in Rotation" },
    // Staff names, as the inbox stores owners
    backup: { type: String, trim: true, default: "" },
    active: { type: Boolean, default: true },
    employees: { type: [String], default: [] },
    maxOpen: { type: Number, default: 20, min: 0, max: 999 },
    during: { type: String, enum: ASSIGN_DURING, default: "Any Time" },
    unavailable: { type: String, enum: WHEN_UNAVAILABLE, default: "Use Next Available Employee" },
    noneAvailable: { type: String, enum: NONE_AVAILABLE, default: "Queue for Team Lead" },
    keepOwner: { type: Boolean, default: true },
    noResponse: { type: String, enum: NO_RESPONSE, default: "Notify Team Lead" },
    reassign: { type: Boolean, default: false },
    delay: { type: String, enum: REASSIGN_DELAYS, default: "Set delay" },
    // Rotation pointer: index in employees of the last one given an enquiry
    lastIndex: { type: Number, default: -1 },
  },
  { _id: false }
);

const enquiryRoutingSchema = new Schema(
  {
    key: { type: String, default: "default", unique: true },
    rules: { type: [ruleSchema], default: [] },
    // Team for enquiries that match no rule
    unmatched: { type: String, trim: true, default: "General Support" },
    // Alert Rules tab, kept as the page sends it (checked in the controller)
    alerts: { type: Schema.Types.Mixed, default: undefined },
    updatedBy: { type: String, trim: true },
  },
  { timestamps: true }
);

const EnquiryRouting = mongoose.model("EnquiryRouting", enquiryRoutingSchema);
export default EnquiryRouting;
