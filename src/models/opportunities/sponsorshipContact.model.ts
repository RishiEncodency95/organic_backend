import mongoose, { Schema } from "mongoose";

const sponsorshipContactSchema = new Schema(
  {
    heading: { type: String, default: "LET'S DISCUSS YOUR SPONSORSHIP GOALS" },
    descriptionLine1: {
      type: String,
      default: "Our team will help you choose the right package to",
    },
    descriptionLine2: {
      type: String,
      default: "maximize your brand visibility and impact.",
    },
    buttonText: { type: String, default: "CONTACT US TODAY" },
    buttonHref: { type: String, default: "/contact" },
  },
  { timestamps: true }
);

const SponsorshipContact = mongoose.model(
  "OrganicSponsorshipContact",
  sponsorshipContactSchema
);

export default SponsorshipContact;
