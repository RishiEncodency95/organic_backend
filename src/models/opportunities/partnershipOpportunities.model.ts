import mongoose, { Schema } from "mongoose";

const oppCardSchema = new Schema(
  {
    num: { type: String, default: "" },
    title: { type: String, default: "" },
    iconKey: { type: String, default: "" },
    benefits: { type: [String], default: [] },
    theme: { type: String, default: "" },
    textTheme: { type: String, default: "" },
    lightBg: { type: String, default: "" },
    link: { type: String, default: "" },
  },
  { _id: false }
);

const partnershipOpportunitiesSchema = new Schema(
  {
    heading: { type: String, default: "PARTNERSHIP OPPORTUNITIES" },
    subheading: { type: String, default: "Our Partner Categories & Benefits" },
    subtitle: {
      type: String,
      default: "Choose a category that fits your business goals and unlock exclusive advantages.",
    },
    opportunities: {
      type: [oppCardSchema],
      default: [
        {
          num: "01",
          title: "HOTEL & STAY PARTNER",
          iconKey: "tog1",
          benefits: [
            "Brand visibility on official platforms",
            "Direct access to exhibitors & delegates",
            "Priority partner listing",
            "Business inquiries & repeat bookings",
            "Exclusive partner rates",
          ],
          theme: "bg-[#1a4f22]",
          textTheme: "text-[#1a4f22]",
          lightBg: "bg-[#f2f7f3]",
          link: "/partnership/hotel-stay-partner",
        },
        {
          num: "02",
          title: "TRAVEL PARTNER",
          iconKey: "tog2",
          benefits: [
            "Featured as official travel partner",
            "Exposure to global exhibitors & buyers",
            "Lead generation opportunities",
            "Association with premium event",
            "Referral business opportunities",
          ],
          theme: "bg-[#e27329]",
          textTheme: "text-[#e27329]",
          lightBg: "bg-[#fcf5f0]",
          link: "/partnership/travel-partner",
        },
        {
          num: "03",
          title: "STALL DESIGN & FABRICATION",
          iconKey: "tog3",
          benefits: [
            "Official branding on event collaterals",
            "High visibility at venue",
            "Access to exhibitors for stall needs",
            "Repeat business potential",
            "Showcase portfolio to global brands",
          ],
          theme: "bg-[#194c21]",
          textTheme: "text-[#194c21]",
          lightBg: "bg-[#f2f7f3]",
          link: "/partnership/stall-design-partner",
        },
        {
          num: "04",
          title: "LOGISTICS PARTNER",
          iconKey: "tog4",
          benefits: [
            "Listed as official logistics partner",
            "International partner recognition",
            "Continuous business opportunities",
            "Access to exhibitors logistics needs",
            "Long-term contracts",
          ],
          theme: "bg-[#07595e]",
          textTheme: "text-[#07595e]",
          lightBg: "bg-[#f0f6f7]",
          link: "/partnership/logistics-partner",
        },
        {
          num: "05",
          title: "PRINTING & BRANDING",
          iconKey: "tog5",
          benefits: [
            "Branding across event materials",
            "On-site branding opportunities",
            "High footfall audience visibility",
            "Year-round referrals",
            "Association with globally recognized event",
          ],
          theme: "bg-[#592b70]",
          textTheme: "text-[#592b70]",
          lightBg: "bg-[#f5f1f7]",
          link: "/partnership/printing-branding-partner",
        },
        {
          num: "06",
          title: "MANPOWER SUPPLY PARTNER",
          iconKey: "tog6",
          benefits: [
            "Recognition as manpower supply partner",
            "Networking with delegates & exhibitors",
            "Brand exposure at venue",
            "Long-term collaboration opportunities",
            "Enhance brand credibility",
          ],
          theme: "bg-[#a57321]",
          textTheme: "text-[#a57321]",
          lightBg: "bg-[#f8f5ef]",
          link: "/partnership/manpower-supply-partner",
        },
      ],
    },
  },
  { timestamps: true }
);

const PartnershipOpportunities = mongoose.model(
  "OrganicPartnershipOpportunities",
  partnershipOpportunitiesSchema
);

export default PartnershipOpportunities;
