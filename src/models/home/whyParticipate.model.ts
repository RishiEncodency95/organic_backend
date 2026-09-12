import mongoose, { Document, Schema } from "mongoose";

const buttonSchema = new Schema({
  text: { type: String, default: '' },
  link: { type: String, default: '' }
}, { _id: false });

const whyParticipateSchema = new Schema({
  enabled: { type: Boolean, default: true },
  sectionTag: { type: String, default: 'WHY PARTICIPATE' },
  eyebrow: { type: String, default: 'WHY PARTICIPATE' },
  titleMain: { type: String, default: 'Your Gateway to' },
  titlePrimary: { type: String, default: 'Your Gateway to' },
  titleHighlight: { type: String, default: 'Global Opportunities' },
  titleSecondary: { type: String, default: 'Global Opportunities' },
  description: { 
    type: String, 
    default: 'Bharat Organic Expo 2027 is a leading platform for organic products, natural health, fitness, Ayurveda, and sustainable innovation—bringing together top brands, buyers, investors, and industry leaders from India and worldwide.' 
  },
  keyPoint1: { 
    type: String, 
    default: 'Meet genuine buyers, distributors, retailers, and healthcare professionals' 
  },
  keyPoint2: { 
    type: String, 
    default: 'Generate high-quality B2B & B2C leads with faster business conversions' 
  },
  keyPoint3: { 
    type: String, 
    default: 'Launch new products with maximum visibility and market impact' 
  },
  keyPoint4: { 
    type: String, 
    default: 'Expand your dealer, distributor, franchise, and export network' 
  },
  keyPoint5: { 
    type: String, 
    default: 'Strengthen brand presence through live demos and media exposure' 
  },
  keyPoint6: { 
    type: String, 
    default: 'Connect with investors, CEOs, doctors, and key decision-makers' 
  },
  keyPoint7: { 
    type: String, 
    default: 'Achieve higher ROI with direct customer engagement and trust building' 
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
  imageAlt: { type: String, default: 'Why Participate in Expo' },
  imageBadgeText: { type: String, default: 'Build Relationships.\nGenerate Leads.\nGrow Your Business.' },
  buttonLabel: { type: String, default: 'BOOK A STALL' },
  buttonHref: { type: String, default: '/registration/book-a-stand' },
  secondaryButtonLabel: { type: String, default: 'Download Brochure' },
  secondaryButtonHref: { type: String, default: '/download/invited card.pdf' },
  tertiaryButtonLabel: { type: String, default: 'Why Exhibit?' },
  tertiaryButtonHref: { type: String, default: '/why-exhibit' },
  mainPoints: { type: [String], default: ['Exhibit', 'Connect', 'Grow'] },
  buttons: {
    stall: { type: buttonSchema, default: { text: 'BOOK A STALL', link: '/registration/book-a-stand' } },
    brochure: { type: buttonSchema, default: { text: 'Download Brochure', link: '/download/invited card.pdf' } },
    moreInfo: { type: buttonSchema, default: { text: 'Why Exhibit?', link: '/why-exhibit' } }
  }
}, { timestamps: true });

const WhyParticipate = mongoose.model("OrganicWhyParticipate", whyParticipateSchema);
export default WhyParticipate;
