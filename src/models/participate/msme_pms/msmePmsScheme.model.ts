import mongoose, { Schema } from "mongoose";

const schemeCardSchema = new Schema(
  {
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    icon: { type: String, default: "" },
  },
  { _id: false }
);

const msmePmsSchemeSchema = new Schema(
  {
    tagline: { type: String, default: "EXHIBITION SUPPORT FOR MSMEs" },
    headingLine1: { type: String, default: "WHAT IS THE" },
    headingLine2: { type: String, default: "PMS SCHEME?" },
    description1: {
      type: String,
      default:
        "The Procurement and Marketing Support (PMS) Scheme is an initiative by the Ministry of Micro, Small and Medium Enterprises (MoMSME), Government of India, designed to enhance the marketability of products and services produced by Micro and Small Enterprises (MSEs).",
    },
    description2: {
      type: String,
      default:
        "Under this scheme, eligible MSEs can receive financial assistance for participating in approved trade fairs and exhibitions like Bharat Organic Expo 2027, reducing space rent costs and promoting domestic market access.",
    },
    cards: {
      type: [schemeCardSchema],
      default: [
        { title: "Space Rent Reimbursement", subtitle: "Up to 80% or 100% space rent assistance", icon: "spaceRent" },
        { title: "Market Access Support", subtitle: "Connect with national & global organic buyers", icon: "marketAccess" },
        { title: "Empowering MSEs", subtitle: "Financial boost for Micro & Small Enterprises", icon: "empowerment" },
      ],
    },
    eligibilityTitle: { type: String, default: "Key Eligibility Criteria" },
    eligibilityList: {
      type: [String],
      default: [
        "Valid Udyam Registration (Micro or Small category)",
        "Manufacturing or Service enterprise dealing in organic / natural products",
        "Subject to Govt. guidelines & approval by competent authority",
      ],
    },
  },
  { timestamps: true }
);

const MsmePmsScheme = mongoose.model("OrganicMsmePmsScheme", msmePmsSchemeSchema);
export default MsmePmsScheme;
