import mongoose, { Schema } from "mongoose";

const packageItemSchema = new Schema(
  {
    name: { type: String, default: "" },
    type: { type: String, default: "" },
    price: { type: String, default: "" },
    color: { type: String, default: "" },
    lightBg: { type: String, default: "" },
    buttonColor: { type: String, default: "" },
    iconKey: { type: String, default: "" },
    features: { type: [String], default: [] },
  },
  { _id: false }
);

const sponsorshipPackagesSchema = new Schema(
  {
    heading: { type: String, default: "OUR SPONSORSHIP PACKAGES" },
    subtitle: { type: String, default: "Choose the package that best suits your brand goals" },
    footerNote: {
      type: String,
      default: "Packages can be customized as per your branding and engagement objectives.",
    },
    packages: {
      type: [packageItemSchema],
      default: [
        {
          name: "PLATINUM\nSPONSOR",
          type: "(Exclusive)",
          price: "₹10,00,000",
          color: "#1e40af",
          lightBg: "#eff6ff",
          buttonColor: "bg-[#1e40af] hover:bg-[#1e3a8a]",
          iconKey: "s1og",
          features: [
            "Premium logo placement on all event collaterals",
            "Speaking opportunity (15 minutes)",
            "Stall space (24 sqm)",
            "Branding on stage backdrop",
            "Full page ad in show catalogue",
            "10 delegate passes",
            "Social media & website recognition",
            "Logo on visitor pre-registration emails",
          ],
        },
        {
          name: "GOLD\nSPONSOR",
          type: "(Limited)",
          price: "₹5,00,000",
          color: "#d97706",
          lightBg: "#fffbeb",
          buttonColor: "bg-[#d97706] hover:bg-[#b45309]",
          iconKey: "s2og",
          features: [
            "Logo on all major collaterals",
            "Speaking opportunity (10 minutes)",
            "Stall space (18 sqm)",
            "Half page ad in show catalogue",
            "6 delegate passes",
            "Social media & website recognition",
            "Logo on selected emailers",
          ],
        },
        {
          name: "SILVER\nSPONSOR",
          type: "(Limited)",
          price: "₹3,00,000",
          color: "#6b7280",
          lightBg: "#f9fafb",
          buttonColor: "bg-[#6b7280] hover:bg-[#4b5563]",
          iconKey: "s3og",
          features: [
            "Logo on major collaterals",
            "Stall space (12 sqm)",
            "Quarter page ad in show catalogue",
            "4 delegate passes",
            "Social media & website recognition",
          ],
        },
        {
          name: "ASSOCIATE\nSPONSOR",
          type: "(Multiple)",
          price: "₹1,50,000",
          color: "#2e7d32",
          lightBg: "#f0fdf4",
          buttonColor: "bg-[#2e7d32] hover:bg-[#1b5e20]",
          iconKey: "s4og",
          features: [
            "Logo on event website",
            "Stall space (9 sqm)",
            "Listing in show catalogue",
            "2 delegate passes",
            "Social media recognition",
          ],
        },
        {
          name: "SUPPORTING\nSPONSOR",
          type: "(Multiple)",
          price: "₹75,000",
          color: "#b45309",
          lightBg: "#fff7ed",
          buttonColor: "bg-[#b45309] hover:bg-[#92400e]",
          iconKey: "s5og",
          features: [
            "Logo on event website",
            "Listing in show catalogue",
            "1 delegate pass",
          ],
        },
      ],
    },
  },
  { timestamps: true }
);

const SponsorshipPackages = mongoose.model(
  "OrganicSponsorshipPackages",
  sponsorshipPackagesSchema
);

export default SponsorshipPackages;
