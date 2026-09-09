import mongoose, { Document, Schema } from "mongoose";

const featureSchema = new Schema({
  icon: { type: String, default: '' },
  title: { type: String, default: '' },
  sub: { type: String, default: '' }
}, { _id: false });

const statSchema = new Schema({
  icon: { type: String, default: '' },
  val: { type: String, default: '' },
  label: { type: String, default: '' }
}, { _id: false });

const premiumBandItemSchema = new Schema({
  icon: { type: String, default: '' },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' }
}, { _id: false });

const buyerSellerMeetSchema = new Schema({
  leftSection: {
    badge: { type: String, default: 'Pre-Scheduled Meetings' },
    titlePrefix: { type: String, default: 'BUYER-SELLER' },
    titleHighlight: { type: String, default: 'MEET 2027' },
    subtitle: { 
      type: String, 
      default: 'Bridging the gap between Organic Buyers and Sustainable Brands' 
    },
    description: { 
      type: String, 
      default: "Join India's most exclusive B2B networking platform for the organic sector. Our highly curated Buyer-Seller Meet brings together certified farmers, eco-friendly product manufacturers, and top-tier global buyers. Pre-schedule your 1-on-1 meetings to secure bulk orders and forge lasting partnerships in the booming sustainable market." 
    },
    features: {
      type: [featureSchema],
      default: [
        { icon: "UserCheck", title: 'VERIFIED', sub: 'ORGANIC BUYERS' },
        { icon: "Handshake", title: '1-ON-1 B2B', sub: 'MEETINGS' },
        { icon: "Globe", title: 'LUCRATIVE GREEN', sub: 'OPPORTUNITIES' },
        { icon: "Store", title: 'EXPAND GLOBAL', sub: 'REACH' }
      ]
    },
    buttons: {
      primary: {
        text: { type: String, default: 'Register Now' },
        link: { type: String, default: '/registration/buyer-registration' }
      },
      secondary: {
        text: { type: String, default: 'View Schedule' },
        link: { type: String, default: '/schedule' }
      }
    }
  },
  rightSection: {
    image: { type: String, default: '' },
    imageAlt: { type: String, default: 'Business Meeting at Expo' }
  },
  statsBar: {
    type: [statSchema],
    default: [
      { icon: "Users", val: '8,000+', label: 'TRADE VISITORS' },
      { icon: "Store", val: '200+', label: 'ORGANIC EXHIBITORS' },
      { icon: "Globe", val: 'GLOBAL', label: 'BUYERS' },
      { icon: "CalendarDays", val: '3 DAYS', label: 'OF NETWORKING' }
    ]
  },
  premiumBand: {
    items: {
      type: [premiumBandItemSchema],
      default: [
        { icon: "Users", title: "GROW TOGETHER.", subtitle: "MEET. CONNECT." },
        { icon: "CalendarDays", title: "19 – 21", subtitle: "FEBRUARY 2027" },
        { icon: "MapPin", title: "PRAGATI MAIDAN", subtitle: "NEW DELHI, INDIA" }
      ]
    },
    button: {
      text: { type: String, default: 'REGISTER AS BUYER!' },
      link: { type: String, default: '/registration/buyer-registration' }
    }
  }
}, { timestamps: true });

const BuyerSellerMeet = mongoose.model("OrganicBuyerSellerMeet", buyerSellerMeetSchema);
export default BuyerSellerMeet;
