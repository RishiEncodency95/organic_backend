import mongoose, { Document, Schema } from "mongoose";

const categorySchema = new Schema({
  title: { type: String, default: '' },
  desc: { type: String, default: '' },
  icon: { type: String, default: '' },
  exclusive: { type: Boolean, default: false }
}, { _id: false });

const statSchema = new Schema({
  count: { type: String, default: '' },
  label: { type: String, default: '' },
  icon: { type: String, default: '' }
}, { _id: false });

const sponsorshipCategoriesSchema = new Schema({
  headerTitle: { type: String, default: 'SPONSORSHIP OPPORTUNITIES' },
  categories: {
    type: [categorySchema],
    default: [
      { title: 'TITLE SPONSOR', desc: 'Maximum visibility & brand exclusivity', icon: 'Trophy', exclusive: true },
      { title: 'POWERED BY SPONSOR', desc: 'Align your brand as the power behind BOE', icon: 'Zap' },
      { title: 'ASSOCIATE SPONSOR', desc: 'High-impact visibility & brand recognition', icon: 'Users' },
      { title: 'CONFERENCE SPONSOR', desc: 'Brand association with knowledge sessions', icon: 'Mic' },
      { title: 'REGISTRATION SPONSOR', desc: 'High brand recall at every entry point', icon: 'UserCheck' },
      { title: 'LANYARD SPONSOR', desc: 'Put your brand around every neck', icon: 'Contact' },
      { title: 'ORGANIC ZONE SPONSOR', desc: 'Showcase your brand in the experience zone', icon: 'Leaf' },
      { title: 'DIGITAL PARTNER', desc: 'Expand your reach across digital platforms', icon: 'MonitorPlay' },
      { title: 'NETWORKING SPONSOR', desc: 'Connect your brand during high-value interactions', icon: 'Calendar' },
      { title: 'INTERNATIONAL SPONSOR', desc: 'Lead the global organic trade discussion', icon: 'Globe' },
      { title: 'VIP LOUNGE SPONSOR', desc: 'Exclusive visibility among top decision makers', icon: 'Star' },
      { title: 'AWARDS SPONSOR', desc: 'Recognize and align with industry excellence', icon: 'Target' }
    ]
  },
  promoBox: {
    bannerTitle: { type: String, default: 'LIMITED SPONSORSHIP SLOTS AVAILABLE' },
    bannerSubtitle: { type: String, default: "Secure your category before it's gone!" },
    bannerFeature: { type: String, default: 'Featured sponsors get exclusive media coverage & brand promotions.' },
    image: { type: String, default: 'https://th-i.thgim.com/public/incoming/z6bs2x/article69071875.ece/alternates/FREE_1200/IMG_iStock-1488883191.jp_2_1_55C17SK5.jpg' },
    imageAlt: { type: String, default: 'Bharat Organic Expo - B2B Exhibition and Conference' },
    badgeLine1: { type: String, default: 'GO ORGANIC' },
    badgeLine2: { type: String, default: 'GO BETTER' },
    titlePrefix: { type: String, default: 'ELEVATE YOUR BRAND PRESENCE' },
    titleHighlight: { type: String, default: 'AT BHARAT ORGANIC EXPO 2027' },
    description: { type: String, default: "meaningful connections and grow your business with India's biggest organic show." },
    stats: {
      type: [statSchema],
      default: [
        { count: "8,000+", label: "Visitors / Delegates", icon: "Users" },
        { count: "200+", label: "Exhibitors", icon: "Target" },
        { count: "1,000+", label: "Global Buyers", icon: "Globe" },
        { count: "Unlimited", label: "Opportunities", icon: "Zap" }
      ]
    },
    buttons: {
      brochureLink: { type: String, default: '/download/invited card.pdf' },
      brochureText: { type: String, default: 'BROCHURE' },
      contactLink: { type: String, default: '/contact' },
      contactText: { type: String, default: 'ANY QUERY?' },
      phoneLink: { type: String, default: 'tel:+919654900525' },
      phoneText: { type: String, default: 'TALK TO US' }
    }
  },
  form: {
    title: { type: String, default: 'INTERESTED IN SPONSORING?' },
    safeText: { type: String, default: 'Your information is safe with us.' }
  }
}, { timestamps: true });

const SponsorshipCategories = mongoose.model("OrganicSponsorshipCategories", sponsorshipCategoriesSchema);
export default SponsorshipCategories;
