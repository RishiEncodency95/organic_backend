import mongoose, { Schema } from "mongoose";

const ctaButtonSchema = new Schema(
  {
    id: { type: String, default: "" },
    label: { type: String, default: "" },
    href: { type: String, default: "" },
    isExternal: { type: Boolean, default: false },
    variant: { type: String, default: "primary" },
  },
  { _id: false }
);

const msmePmsBannerSchema = new Schema(
  {
    category: { type: String, default: "MSME procurement & marketing support" },
    titleLine1: { type: String, default: "MSME PMS" },
    titleHighlight: { type: String, default: "Scheme" },
    titleLine2: { type: String, default: "Exhibition Support" },
    subtitle: { type: String, default: "Exhibit. Connect. Grow with Government Support" },
    descriptionText1: {
      type: String,
      default: "Eligible Micro & Small Enterprises can explore financial assistance for participation in ",
    },
    eventHighlight: { type: String, default: "Bharat Organic Expo 2027" },
    descriptionText2: {
      type: String,
      default: " under the applicable Procurement & Marketing Support (PMS) Scheme.",
    },
    dates: { type: String, default: "19-21 February 2027" },
    venue: { type: String, default: "Hall 12, Bharat Mandapam, New Delhi" },
    ctaButtons: {
      type: [ctaButtonSchema],
      default: [
        {
          id: "eligibility",
          label: "CHECK PMS ELIGIBILITY",
          href: "/participate/msme/eligibility-check",
          isExternal: true,
          variant: "primary",
        },
        {
          id: "support",
          label: "GET PMS SUPPORT",
          href: "tel:+9654900525",
          isExternal: false,
          variant: "secondary",
        },
      ],
    },
  },
  { timestamps: true }
);

const MsmePmsBanner = mongoose.model("OrganicMsmePmsBanner", msmePmsBannerSchema);
export default MsmePmsBanner;
