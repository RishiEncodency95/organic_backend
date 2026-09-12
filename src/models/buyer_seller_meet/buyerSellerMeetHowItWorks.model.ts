import mongoose, { Schema } from "mongoose";

const stepItemSchema = new Schema(
  {
    num: { type: String, default: "" },
    img: { type: String, default: "" },
    title: { type: String, default: "" },
    desc: { type: String, default: "" },
  },
  { _id: false }
);

const buyerSellerMeetHowItWorksSchema = new Schema(
  {
    heading: { type: String, default: "HOW IT WORKS" },
    steps: {
      type: [stepItemSchema],
      default: [
        {
          num: "01",
          img: "h1og",
          title: "REGISTER",
          desc: "Submit your business\nprofile and areas\nof interest.",
        },
        {
          num: "02",
          img: "h2og",
          title: "PROFILE REVIEW",
          desc: "Registration details are\nreviewed for relevance to\nthe Buyer-Seller Meet.",
        },
        {
          num: "03",
          img: "h3og",
          title: "BUSINESS MATCHING",
          desc: "Relevant buyer and seller\ninterests are identified\nbased on available profiles.",
        },
        {
          num: "04",
          img: "h4og",
          title: "MEETING SCHEDULING",
          desc: "Eligible participants receive\nmeeting information/schedules,\nsubject to availability.",
        },
        {
          num: "05",
          img: "h5og",
          title: "MEET AT THE EXPO",
          desc: "Participate in focused B2B\ninteractions during\nBharat Organic Expo 2027.",
        },
      ],
    },
  },
  { timestamps: true }
);

const BuyerSellerMeetHowItWorks = mongoose.model(
  "OrganicBuyerSellerMeetHowItWorks",
  buyerSellerMeetHowItWorksSchema
);

export default BuyerSellerMeetHowItWorks;
