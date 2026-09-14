import mongoose, { Schema } from "mongoose";

const awardsNominationSchema = new Schema(
  {
    applicantType: { type: String, default: "" },
    orgName: { type: String, default: "" },
    contactPerson: { type: String, default: "" },
    designation: { type: String, default: "" },
    mobile: { type: String, default: "" },
    email: { type: String, default: "" },
    website: { type: String, default: "" },
    city: { type: String, default: "" },
    stateCountry: { type: String, default: "" },
    awardCategory: { type: String, default: "" },
    briefProfile: { type: String, default: "" },
    yearsExperience: { type: String, default: "" },
    teamSize: { type: String, default: "" },
    keyServices: { type: String, default: "" },
    keyAchievements: { type: String, default: "" },
    uniqueContribution: { type: String, default: "" },
    impactCreated: { type: String, default: "" },
    innovation: { type: String, default: "" },
    whyDeserve: { type: String, default: "" },
    deckFile: { type: String, default: "" },
    certFile: { type: String, default: "" },
    mediaFile: { type: String, default: "" },
    deckFileName: { type: String, default: "" },
    certFileName: { type: String, default: "" },
    mediaFileName: { type: String, default: "" },
    socialLink: { type: String, default: "" },
    declaration: { type: Boolean, default: false },
    status: { type: String, default: "pending" },
  },
  { timestamps: true }
);

const AwardsNomination = mongoose.model(
  "OrganicAwardsNomination",
  awardsNominationSchema
);
export default AwardsNomination;
