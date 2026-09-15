import mongoose, { Schema } from "mongoose";

const cardSchema = new Schema(
  {
    num: { type: String, default: "" },
    img: { type: String, default: "" },
    image: { type: String, default: "" },
    title: { type: String, default: "" },
    desc: { type: String, default: "" },
    description: { type: String, default: "" },
  },
  { _id: false }
);

const whyVisitMattersSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    image: { type: String, default: "/uploads/icons/band.png" },
    bandImg: { type: String, default: "/uploads/icons/band.png" },
    imageAlt: { type: String, default: "Business Opportunities Under One Roof" },
    title: { type: String, default: "Why Your Visit Matters" },
    subtitle: {
      type: String,
      default: "Bharat Organic Expo brings the right products, suppliers and decision-makers together,",
    },
    subline1: {
      type: String,
      default: "Bharat Organic Expo brings the right products, suppliers and decision-makers together,",
    },
    description: {
      type: String,
      default: "creating real opportunities for your business growth.",
    },
    shortDescription: {
      type: String,
      default: "creating real opportunities for your business growth.",
    },
    subline2: {
      type: String,
      default: "creating real opportunities for your business growth.",
    },
    cards: {
      type: [cardSchema],
      default: [
        {
          num: "01",
          img: "/uploads/icons/v1og.png",
          image: "/uploads/icons/v1og.png",
          title: "Discover New Products",
          desc: "Explore a wide range of new launches, innovative products and emerging brands across multiple categories.",
          description: "Explore a wide range of new launches, innovative products and emerging brands across multiple categories.",
        },
        {
          num: "02",
          img: "/uploads/icons/v2og.png",
          image: "/uploads/icons/v2og.png",
          title: "Meet Manufacturers",
          desc: "Connect directly with verified manufacturers, producers and suppliers from across India and beyond.",
          description: "Connect directly with verified manufacturers, producers and suppliers from across India and beyond.",
        },
        {
          num: "03",
          img: "/uploads/icons/v3og.png",
          image: "/uploads/icons/v3og.png",
          title: "Source for Your Business",
          desc: "Find the right products for retail, distribution, e-commerce, hospitality, institutional procurement and more.",
          description: "Find the right products for retail, distribution, e-commerce, hospitality, institutional procurement and more.",
        },
        {
          num: "04",
          img: "/uploads/icons/v4og.png",
          image: "/uploads/icons/v4og.png",
          title: "Explore Private Label",
          desc: "Meet brands and manufacturers offering OEM, contract manufacturing and private-label opportunities.",
          description: "Meet brands and manufacturers offering OEM, contract manufacturing and private-label opportunities.",
        },
        {
          num: "05",
          img: "/uploads/icons/v5og.png",
          image: "/uploads/icons/v5og.png",
          title: "Build Partnerships",
          desc: "Explore dealership, distributorship, collaboration and long-term business partnership opportunities.",
          description: "Explore dealership, distributorship, collaboration and long-term business partnership opportunities.",
        },
        {
          num: "06",
          img: "/uploads/icons/v6og.png",
          image: "/uploads/icons/v6og.png",
          title: "Understand Market Trends",
          desc: "Gain insights into market trends, consumer demand, industry innovations and future business opportunities.",
          description: "Gain insights into market trends, consumer demand, industry innovations and future business opportunities.",
        },
      ],
    },
    items: {
      type: [cardSchema],
      default: [
        {
          num: "01",
          img: "/uploads/icons/v1og.png",
          image: "/uploads/icons/v1og.png",
          title: "Discover New Products",
          desc: "Explore a wide range of new launches, innovative products and emerging brands across multiple categories.",
          description: "Explore a wide range of new launches, innovative products and emerging brands across multiple categories.",
        },
        {
          num: "02",
          img: "/uploads/icons/v2og.png",
          image: "/uploads/icons/v2og.png",
          title: "Meet Manufacturers",
          desc: "Connect directly with verified manufacturers, producers and suppliers from across India and beyond.",
          description: "Connect directly with verified manufacturers, producers and suppliers from across India and beyond.",
        },
        {
          num: "03",
          img: "/uploads/icons/v3og.png",
          image: "/uploads/icons/v3og.png",
          title: "Source for Your Business",
          desc: "Find the right products for retail, distribution, e-commerce, hospitality, institutional procurement and more.",
          description: "Find the right products for retail, distribution, e-commerce, hospitality, institutional procurement and more.",
        },
        {
          num: "04",
          img: "/uploads/icons/v4og.png",
          image: "/uploads/icons/v4og.png",
          title: "Explore Private Label",
          desc: "Meet brands and manufacturers offering OEM, contract manufacturing and private-label opportunities.",
          description: "Meet brands and manufacturers offering OEM, contract manufacturing and private-label opportunities.",
        },
        {
          num: "05",
          img: "/uploads/icons/v5og.png",
          image: "/uploads/icons/v5og.png",
          title: "Build Partnerships",
          desc: "Explore dealership, distributorship, collaboration and long-term business partnership opportunities.",
          description: "Explore dealership, distributorship, collaboration and long-term business partnership opportunities.",
        },
        {
          num: "06",
          img: "/uploads/icons/v6og.png",
          image: "/uploads/icons/v6og.png",
          title: "Understand Market Trends",
          desc: "Gain insights into market trends, consumer demand, industry innovations and future business opportunities.",
          description: "Gain insights into market trends, consumer demand, industry innovations and future business opportunities.",
        },
      ],
    },
    lowerTitle: { type: String, default: "One Visit. Multiple Opportunities." },
    lowerDescription: {
      type: String,
      default: "Save time, meet the right people and take your business to the next level.",
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
