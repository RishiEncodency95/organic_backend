import mongoose, { Schema } from "mongoose";

const eligibleExpenseSchema = new Schema(
  {
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    icon: { type: String, default: "" },
  },
  { _id: false }
);

const msmeSupportCoverSchema = new Schema(
  {
    heading: { type: String, default: "Eligible Expenses Covered Under PMS for Exhibition Participation" },
    expenses: {
      type: [eligibleExpenseSchema],
      default: [
        {
          title: "Space Rent Assistance",
          description: "Subsidized space rent for built-up stalls as per applicable eligibility percentages.",
          icon: "spaceRent",
        },
        {
          title: "Stall Setup Support",
          description: "Basic infrastructure & stall facilities provided within scheme framework.",
          icon: "stallSetup",
        },
        {
          title: "Contingency Travel / Freight",
          description: "Reimbursement towards travel & goods transport up to ceiling limits.",
          icon: "travelFreight",
        },
        {
          title: "Publicity & Branding",
          description: "Product promotion & visibility assistance during the trade fair.",
          icon: "branding",
        },
      ],
    },
    contingencyTitle: { type: String, default: "Additional Contingency Support" },
    contingencyAmount: { type: String, default: "Up to ₹25,000*" },
    contingencyItems: { type: [String], default: ["Travel", "Freight", "Publicity"] },
    contingencyNote: {
      type: String,
      default: "100% of eligible contingency expenditure, subject to applicable ceiling and PMS guidelines.",
    },
    knowBeforeTitle: { type: String, default: "Know Before You Apply" },
    knowBeforeSub: {
      type: String,
      default:
        "Actual assistance depends on enterprise category, eligible expenditure, approved participation, applicable limits, supporting documents and final sanction by competent authority.",
    },
  },
  { timestamps: true }
);

const MsmeSupportCover = mongoose.model("OrganicMsmeSupportCover", msmeSupportCoverSchema);
export default MsmeSupportCover;
