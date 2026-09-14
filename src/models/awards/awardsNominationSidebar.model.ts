import mongoose, { Schema } from "mongoose";

const awardsNominationSidebarSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    whyParticipate: {
      title: { type: String, default: "WHY PARTICIPATE?" },
      items: [{ type: String }],
    },
    importantDates: {
      title: { type: String, default: "IMPORTANT DATES" },
      disclaimer: { type: String, default: "*Dates are subject to change." },
      items: [
        {
          label: { type: String, default: "" },
          value: { type: String, default: "" },
        },
      ],
    },
    whoCanApply: {
      title: { type: String, default: "WHO CAN APPLY?" },
      note: {
        type: String,
        default: "Open to Indian & International participants.",
      },
      items: [{ type: String }],
    },
    needHelp: {
      title: { type: String, default: "NEED HELP?" },
      description: {
        type: String,
        default: "For any assistance, feel free to contact our awards team.",
      },
      phone: { type: String, default: "+91 96549 00525" },
      email: { type: String, default: "awards@bharatorganicexpo.com" },
      website: { type: String, default: "www.bharatorganicexpo.com" },
    },
  },
  { timestamps: true }
);

const AwardsNominationSidebar = mongoose.model(
  "OrganicAwardsNominationSidebar",
  awardsNominationSidebarSchema
);
export default AwardsNominationSidebar;
