import mongoose, { Document, Schema } from "mongoose";

export interface IHomeHero extends Document {
  img?: string;
  image?: string;
  alt?: string;
  tagline?: string;
  title?: string;
  titlePrimary?: string;
  titleSecondary?: string;
  subtitle?: string;
  description?: string;
  date?: string;
  location?: string;
  status?: string;
  button1Name?: string;
  button1Link?: string;
  button2Name?: string;
  button2Link?: string;
  buttonLabel?: string;
  buttonHref?: string;
  secondaryButtonLabel?: string;
  secondaryButtonHref?: string;
}

const homeHeroSchema = new Schema(
  {
    img: { type: String, default: "" },
    image: { type: String, default: "" },
    alt: { type: String, default: "" },
    tagline: { type: String, default: "" },
    title: { type: String, default: "" },
    titlePrimary: { type: String, default: "" },
    titleSecondary: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    description: { type: String, default: "" },
    date: { type: String, default: "" },
    location: { type: String, default: "" },
    status: { type: String, default: "active" },
    button1Name: { type: String, default: "" },
    button1Link: { type: String, default: "" },
    button2Name: { type: String, default: "" },
    button2Link: { type: String, default: "" },
    buttonLabel: { type: String, default: "" },
    buttonHref: { type: String, default: "" },
    secondaryButtonLabel: { type: String, default: "" },
    secondaryButtonHref: { type: String, default: "" },
  },
  { timestamps: true }
);

const HomeHero = mongoose.model<IHomeHero>("OrganicHomeHero", homeHeroSchema);
export default HomeHero;
