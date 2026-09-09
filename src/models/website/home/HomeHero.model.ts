import mongoose, { Document, Schema } from "mongoose";

const homeHeroSchema = new Schema({
  img: { type: String, default: '' },
  alt: { type: String, default: '' },
  tagline: { type: String, default: '' },
  titlePrimary: { type: String, default: '' },
  titleSecondary: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  description: { type: String, default: '' },
  date: { type: String, default: '' },
  location: { type: String, default: '' },
  status: { type: String, default: 'active' },
  button1Name: { type: String, default: '' },
  button1Link: { type: String, default: '' },
  button2Name: { type: String, default: '' },
  button2Link: { type: String, default: '' }
}, { timestamps: true });

// Attach to global.secondaryDB (ORGANIC DB)
const HomeHero = mongoose.model("OrganicHomeHero", homeHeroSchema);
export default HomeHero;
