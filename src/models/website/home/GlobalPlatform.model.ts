import mongoose, { Document, Schema } from "mongoose";

const cardSchema = new Schema({
  iconSrc: { type: String, default: '' },
  iconAlt: { type: String, default: '' },
  iconWidth: { type: Number, default: 90 },
  iconHeight: { type: Number, default: 90 },
  title: { type: String, default: '' },
  desc: { type: String, default: '' },
  bgClass: { type: String, default: '' },
  borderClass: { type: String, default: '' }
});

const globalPlatformSchema = new Schema({
  badge: { type: String, default: 'FROM INDIA TO THE WORLD' },
  title: {
    line1: { type: String, default: 'From a National Expo' },
    highlight: { type: String, default: 'Global Platform' }
  },
  description: { type: String, default: "Bharat Organic Expo is India's most influential platform connecting organic products, people and possibilities." },
  listItems: [{ type: String }],
  cards: [cardSchema]
}, { timestamps: true });

const GlobalPlatform = mongoose.model("OrganicGlobalPlatform", globalPlatformSchema);
export default GlobalPlatform;
