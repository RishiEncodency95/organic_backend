import mongoose, { Schema } from "mongoose";

const cardSchema = new Schema(
  {
    num: { type: String, default: "" },
    img: { type: String, default: "" },
    title: { type: String, default: "" },
    desc: { type: String, default: "" },
  },
  { _id: false }
);

const whyVisitMattersSchema = new Schema(
  {
    title: { type: String, default: "Why Your Visit Matters" },
    subline1: {
      type: String,
      default: "Bharat Organic Expo brings the right products, suppliers and decision-makers together,",
    },
    subline2: { type: String, default: "creating real opportunities for your business growth." },
    cards: {
      type: [cardSchema],
      default: [
        {
          num: "01",
          img: "",
          title: "Discover New Products",
          desc: "Explore a wide range of new launches, innovative products and emerging brands across multiple categories.",
        },
        {
          num: "02",
          img: "",
          title: "Meet Manufacturers",
          desc: "Connect directly with verified manufacturers, producers and suppliers from across India and beyond.",
        },
        {
          num: "03",
          img: "",
          title: "Source for Your Business",
          desc: "Find the right products for retail, distribution, e-commerce, hospitality, institutional procurement and more.",
        },
        {
          num: "04",
          img: "",
          title: "Explore Private Label",
          desc: "Meet brands and manufacturers offering OEM, contract manufacturing and private-label opportunities.",
        },
        {
          num: "05",
          img: "",
          title: "Build Partnerships",
          desc: "Explore dealership, distributorship, collaboration and long-term business partnership opportunities.",
        },
        {
          num: "06",
          img: "",
          title: "Understand Market Trends",
          desc: "Gain insights into market trends, consumer demand, industry innovations and future business opportunities.",
        },
      ],
    },
    bannerTitle: { type: String, default: "One Visit. Multiple Opportunities." },
    bannerDesc: {
      type: String,
      default: "Save time, meet the right people and take your business to the next level.",
    },
  },
  { timestamps: true }
);

const WhyVisitMatters = mongoose.model("OrganicWhyVisitMatters", whyVisitMattersSchema);
export default WhyVisitMatters;
