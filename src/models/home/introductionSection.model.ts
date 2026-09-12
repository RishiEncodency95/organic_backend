import mongoose, { Document, Schema } from "mongoose";

export interface IIntroductionSection extends Document {
  enabled: boolean;
  eyebrow: string;
  titlePrimary: string;
  titleSecondary: string;
  subtitle: string;
  description: string;
  description2: string;
  image: string;
  imageAlt: string;
  buttonLabel: string;
  buttonHref: string;
  timerTitle: string;
  eventDate: string;
  showTimer: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const introductionSectionSchema = new Schema<IIntroductionSection>(
  {
    enabled: { type: Boolean, default: true },
    eyebrow: { type: String, default: "INTRODUCTION" },
    titlePrimary: { type: String, default: "WELCOME TO BHARAT ORGANIC EXPO" },
    titleSecondary: { type: String, default: "2027" },
    subtitle: {
      type: String,
      default:
        "India's Premier Platform for Organic Products, Sustainable Agriculture & Natural Living",
    },
    description: {
      type: String,
      default:
        "Bharat Organic Expo 2027 is India's leading international exhibition dedicated to organic products, sustainable agriculture, natural wellness, eco-friendly innovations, and green business opportunities. The Expo brings together manufacturers, exhibitors, buyers, importers, exporters, investors, government organizations, industry experts, startups, researchers, and global delegates under one dynamic platform.",
    },
    description2: {
      type: String,
      default:
        "Designed to foster business growth, knowledge sharing, innovation, and international collaboration, Bharat Organic Expo serves as the perfect destination for discovering new products, building strategic partnerships, expanding global markets, and promoting a sustainable future.",
    },
    image: {
      type: String,
      default:
        "https://res.cloudinary.com/dr8mld4i0/image/upload/v1788165233/moksha-sewa/assets/km.jpg",
    },
    imageAlt: {
      type: String,
      default: "Bharat Organic Expo 2027 Introduction",
    },
    buttonLabel: { type: String, default: "Explore Exhibition" },
    buttonHref: { type: String, default: "/about" },
    timerTitle: { type: String, default: "EVENT BEGINS IN" },
    eventDate: { type: String, default: "2027-02-19T00:00:00" },
    showTimer: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const IntroductionSection = mongoose.model<IIntroductionSection>(
  "OrganicIntroductionSection",
  introductionSectionSchema
);

export default IntroductionSection;
