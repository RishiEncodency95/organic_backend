import mongoose, { Document, Schema } from "mongoose";

const buttonSchema = new Schema({
  text: { type: String, default: '' },
  link: { type: String, default: '' }
}, { _id: false });

const whyParticipateSchema = new Schema({
  sectionTag: { type: String, default: 'WHY PARTICIPATE' },
  titleMain: { type: String, default: 'Your Gateway to' },
  titleHighlight: { type: String, default: 'Global Opportunities' },
  description: { 
    type: String, 
    default: 'Bharat Organic Expo 2027 is a leading platform for organic products, natural health, fitness, Ayurveda, and sustainable innovation—bringing together top brands, buyers, investors, and industry leaders from India and worldwide.' 
  },
  points: { 
    type: [String], 
    default: [
      "Meet genuine buyers, distributors, retailers, and healthcare professionals",
      "Generate high-quality B2B & B2C leads with faster business conversions",
      "Launch new products with maximum visibility and market impact",
      "Expand your dealer, distributor, franchise, and export network",
      "Strengthen brand presence through live demos and media exposure",
      "Connect with investors, CEOs, doctors, and key decision-makers",
      "Achieve higher ROI with direct customer engagement and trust building"
    ] 
  },
  image: { type: String, default: '' },
  imageAlt: { type: String, default: 'Business Meeting at Expo' },
  imageBadgeText: { type: String, default: 'Build Relationships.\nGenerate Leads.\nGrow Your Business.' },
  mainPoints: { type: [String], default: ['Exhibit', 'Connect', 'Grow'] },
  buttons: {
    stall: { type: buttonSchema, default: { text: 'BOOK A STALL', link: '/registration/book-a-stand' } },
    brochure: { type: buttonSchema, default: { text: 'Download Brochure', link: '/download/invited card.pdf' } },
    moreInfo: { type: buttonSchema, default: { text: 'Why Exhibit?', link: '/why-exhibit' } }
  }
}, { timestamps: true });

const WhyParticipate = mongoose.model("OrganicWhyParticipate", whyParticipateSchema);
export default WhyParticipate;
