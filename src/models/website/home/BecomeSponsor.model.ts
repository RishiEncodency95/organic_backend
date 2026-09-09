import mongoose, { Document, Schema } from "mongoose";

const featureSchema = new Schema({
  icon: { type: String, default: '' },
  title: { type: String, default: '' },
  highlight: { type: String, default: '' }
}, { _id: false });

const becomeSponsorSchema = new Schema({
  leftSection: {
    tag: { type: String, default: 'Sponsorship Opportunities Open' },
    titlePrefix: { type: String, default: 'BECOME A' },
    titleHighlight: { type: String, default: 'SPONSOR' },
    calloutText: { type: String, default: 'Position your brand at the forefront of the organic industry' },
    description: { 
      type: String, 
      default: "Partner with Bharat Organic Expo 2027 and unlock premium visibility, strategic connections, and unmatched business opportunities with global industry leaders, key decision-makers, and prominent eco-conscious buyers. Elevate your brand presence in Asia's most rapidly expanding organic and natural products market." 
    }
  },
  centerSection: {
    image: { type: String, default: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?w=800&auto=format&fit=crop&q=80' },
    imageAlt: { type: String, default: 'Exhibition Stall' },
    overlayTag: { type: String, default: 'Premium Booths' },
    overlayText: { type: String, default: 'STRONGER TOGETHER FOR A HEALTHIER TOMORROW' }
  },
  rightSection: {
    titlePrefix: { type: String, default: 'WHY SPONSOR' },
    titleHighlight: { type: String, default: 'BHARAT ORGANIC EXPO?' },
    features: {
      type: [featureSchema],
      default: [
        { icon: "Users", title: 'Showcase your brand to', highlight: '8,000+ targeted visitors' },
        { icon: "Megaphone", title: 'Multi-channel promotion', highlight: '(digital + on-ground)' },
        { icon: "ShieldCheck", title: 'Build authority in the', highlight: 'organic & natural ecosystem' },
        { icon: "Star", title: 'Premium branding across', highlight: 'expo touchpoints' },
        { icon: "Target", title: 'Direct access to', highlight: 'decision-makers & buyers' },
        { icon: "Globe", title: 'Global exposure &', highlight: 'networking opportunities' }
      ]
    }
  }
}, { timestamps: true });

const BecomeSponsor = mongoose.model("OrganicBecomeSponsor", becomeSponsorSchema);
export default BecomeSponsor;
