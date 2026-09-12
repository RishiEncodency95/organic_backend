import mongoose, { Document, Schema } from "mongoose";

export interface IExtraItem {
  title?: string;
  title2?: string;
  subtitle?: string;
  description?: string;
  icon?: string;
}

export interface IBeyondExhibition extends Document {
  enabled: boolean;
  sectionTag: string;
  titleMain: string;
  titleHighlight: string;
  description: string;
  image: string;
  imageAlt: string;
  items: IExtraItem[];
  extras: IExtraItem[];
  createdAt?: Date;
  updatedAt?: Date;
}

const extraSchema = new Schema({
  title: { type: String, default: '' },
  title2: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  description: { type: String, default: '' },
  icon: { type: String, default: '' }
}, { _id: false });

const beyondExhibitionSchema = new Schema({
  enabled: { type: Boolean, default: true },
  sectionTag: { type: String, default: 'Global Organic Platform' },
  titleMain: { type: String, default: 'Beyond An' },
  titleHighlight: { type: String, default: 'Exhibition' },
  description: { 
    type: String, 
    default: "Join India's most powerful ecosystem for the organic industry. From high-impact B2B matchmaking and leadership summits to global networking, we provide everything you need to scale your business." 
  },
  image: { type: String, default: '' },
  imageAlt: { type: String, default: 'Conferences & Seminars' },
  items: { 
    type: [extraSchema], 
    default: [
      { title: "GLOBAL CONFERENCES", description: "Gain actionable insights and explore emerging trends with global industry experts.", subtitle: "Gain actionable insights and explore emerging trends with global industry experts.", icon: "Users" },
      { title: "LEADERSHIP SUMMITS", description: "Engage with top policymakers and CEOs driving sustainable change.", subtitle: "Engage with top policymakers and CEOs driving sustainable change.", icon: "Briefcase" },
      { title: "ORGANIC AWARDS", description: "Celebrate excellence and recognize pioneering brands in the organic sector.", subtitle: "Celebrate excellence and recognize pioneering brands in the organic sector.", icon: "Award" },
      { title: "STARTUP SHOWCASE", description: "Discover innovative startups pitching groundbreaking green technologies.", subtitle: "Discover innovative startups pitching groundbreaking green technologies.", icon: "Lightbulb" },
      { title: "B2B MEETINGS", description: "Network with top distributors and build lasting global partnerships.", subtitle: "Network with top distributors and build lasting global partnerships.", icon: "Handshake" },
      { title: "GLOBAL DELEGATION", description: "Connect with international delegates to expand your market reach.", subtitle: "Connect with international delegates to expand your market reach.", icon: "Globe" },
      { title: "SUSTAINABILITY WORKSHOPS", description: "Learn practical implementations for zero-waste and eco-friendly practices.", subtitle: "Learn practical implementations for zero-waste and eco-friendly practices.", icon: "Leaf" },
      { title: "PRODUCT LAUNCHPAD", description: "Witness the exclusive unveiling of the latest natural and organic innovations.", subtitle: "Witness the exclusive unveiling of the latest natural and organic innovations.", icon: "Store" }
    ]
  },
  extras: { 
    type: [extraSchema], 
    default: [
      { title: "GLOBAL", title2: "CONFERENCES", subtitle: "Gain actionable insights and explore emerging trends with global industry experts.", description: "Gain actionable insights and explore emerging trends with global industry experts.", icon: "Users" },
      { title: "LEADERSHIP", title2: "SUMMITS", subtitle: "Engage with top policymakers and CEOs driving sustainable change.", description: "Engage with top policymakers and CEOs driving sustainable change.", icon: "Briefcase" },
      { title: "ORGANIC", title2: "AWARDS", subtitle: "Celebrate excellence and recognize pioneering brands in the organic sector.", description: "Celebrate excellence and recognize pioneering brands in the organic sector.", icon: "Award" },
      { title: "STARTUP", title2: "SHOWCASE", subtitle: "Discover innovative startups pitching groundbreaking green technologies.", description: "Discover innovative startups pitching groundbreaking green technologies.", icon: "Lightbulb" },
      { title: "B2B", title2: "MEETINGS", subtitle: "Network with top distributors and build lasting global partnerships.", description: "Network with top distributors and build lasting global partnerships.", icon: "Handshake" },
      { title: "GLOBAL", title2: "DELEGATION", subtitle: "Connect with international delegates to expand your market reach.", description: "Connect with international delegates to expand your market reach.", icon: "Globe" },
      { title: "SUSTAINABILITY", title2: "WORKSHOPS", subtitle: "Learn practical implementations for zero-waste and eco-friendly practices.", description: "Learn practical implementations for zero-waste and eco-friendly practices.", icon: "Leaf" },
      { title: "PRODUCT", title2: "LAUNCHPAD", subtitle: "Witness the exclusive unveiling of the latest natural and organic innovations.", description: "Witness the exclusive unveiling of the latest natural and organic innovations.", icon: "Store" }
    ]
  }
}, { timestamps: true });

const BeyondExhibition = mongoose.model<IBeyondExhibition>("OrganicBeyondExhibition", beyondExhibitionSchema);
export default BeyondExhibition;
