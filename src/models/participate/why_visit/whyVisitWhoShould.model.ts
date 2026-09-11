import mongoose, { Schema } from "mongoose";

const cardSchema = new Schema(
  {
    icon: { type: String, default: "" },
    title: { type: String, default: "" },
    desc: { type: String, default: "" },
  },
  { _id: false }
);

const whyVisitWhoShouldSchema = new Schema(
  {
    titleLine1: { type: String, default: "WHO SHOULD" },
    titleLine2: { type: String, default: "VISIT & BENEFIT?" },
    subline: { type: String, default: "ONE PLATFORM. UNLIMITED OPPORTUNITIES." },
    desc: {
      type: String,
      default:
        "Bharat Organic Expo brings together a diverse ecosystem of industry leaders, innovators, buyers, and sustainable farming pioneers driving India’s organic revolution.",
    },
    cardData: {
      type: [cardSchema],
      default: [
        {
          icon: "",
          title: "BUSINESSES & ENTREPRENEURS",
          desc: "Manufacturers, suppliers, brand owners, exporters and startups looking to expand market reach, launch new products or source premium organic ingredients.",
        },
        {
          icon: "",
          title: "DISTRIBUTORS & RETAILERS",
          desc: "Wholesalers, importers, retail chains, supermarkets and e-commerce buyers seeking certified organic products, exclusive partnerships and profitable trade deals.",
        },
        {
          icon: "",
          title: "ORGANIC FARMERS & PRODUCERS",
          desc: "Farmers, FPOs, agricultural cooperatives and producers looking for high-yield organic inputs, modern agri-tech, direct buyer linkages and value addition solutions.",
        },
        {
          icon: "",
          title: "HEALTH & WELLNESS PROFESSIONALS",
          desc: "Nutritionists, dietitians, ayurvedic practitioners, wellness experts and health therapists exploring authentic natural, herbal and organic wellness solutions.",
        },
        {
          icon: "",
          title: "INVESTORS & POLICY MAKERS",
          desc: "Venture capitalists, angel investors, policy makers, government officials and advisors keen to back sustainable green ventures and strengthen the ecosystem.",
        },
        {
          icon: "",
          title: "MEDIA & CONTENT CREATORS",
          desc: "Journalists, bloggers, digital content creators and influencers covering emerging sustainable organic trends, innovations and inspiring success stories.",
        },
      ],
    },
    brandLine1: { type: String, default: "BE PART OF INDIA’S" },
    brandLine2: { type: String, default: "ORGANIC MOVEMENT!" },
    subtext1: { type: String, default: "Connect. Collaborate. Innovate. Grow." },
    subtext2: { type: String, default: "The future is organic. Let’s build it together." },
    ctaText: { type: String, default: "JOIN THE MOVEMENT. CREATE A BETTER TOMORROW." },
    ctaHref: { type: String, default: "/registration/visitor-registration" },
  },
  { timestamps: true }
);

const WhyVisitWhoShould = mongoose.model("OrganicWhyVisitWhoShould", whyVisitWhoShouldSchema);
export default WhyVisitWhoShould;
