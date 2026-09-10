import mongoose, { Document, Schema } from "mongoose";

const leftItemSchema = new Schema({
  title: { type: String, default: '' },
  desc: { type: String, default: '' },
  icon: { type: String, default: '' }
}, { _id: false });

const rightItemSchema = new Schema({
  label: { type: String, default: '' },
  icon: { type: String, default: '' }
}, { _id: false });

const sponsorsAndAttendSchema = new Schema({
  leftSection: {
    titlePrefix: { type: String, default: 'WHY' },
    titleHighlight: { type: String, default: 'ATTEND?' },
    description: { 
      type: String, 
      default: 'Explore innovations, build connections and gain insights that drive better health and stronger businesses.' 
    },
    itemsLeft: {
      type: [leftItemSchema],
      default: [
        { title: "DISCOVER", desc: "Explore the latest organic products and eco-friendly services driving a sustainable future.", icon: "Lightbulb" },
        { title: "CONNECT", desc: "Meet leading organic brands, manufacturers and sustainable suppliers under one roof.", icon: "Handshake" },
        { title: "GROW", desc: "Unlock new green business opportunities, partnerships and eco-investment possibilities.", icon: "TrendingUp" }
      ]
    },
    itemsRight: {
      type: [leftItemSchema],
      default: [
        { title: "LEARN", desc: "Attend seminars, workshops and live demos by organic agriculture and sustainability experts.", icon: "BookOpen" },
        { title: "SOURCE", desc: "Find trusted organic suppliers, distributors and eco-franchise opportunities.", icon: "PackageSearch" },
        { title: "STAY AHEAD", desc: "Stay updated with market trends, conscious consumer insights and future organic industry developments.", icon: "Zap" }
      ]
    }
  },
  centerSection: {
    text1: { type: String, default: 'ONE PLATFORM.' },
    text2: { type: String, default: 'ORGANIC' },
    text3: { type: String, default: 'OPPORTUNITIES.' }
  },
  rightSection: {
    title: { type: String, default: 'WHO SHOULD ATTEND?' },
    bottomText: { 
      type: String, 
      default: "Whether you're sourcing, learning or networking — this is the place to be!" 
    },
    items: {
      type: [rightItemSchema],
      default: [
        { label: "Organic Distributors, Wholesalers & Retailers", icon: "ShoppingCart" },
        { label: "Eco-Importers & Exporters", icon: "Globe" },
        { label: "Ayurvedic Institutions & Wellness Centers", icon: "Hospital" },
        { label: "Nutritionists, Farmers & Wellness Experts", icon: "Stethoscope" },
        { label: "Gym Owners, Spa & Eco-Fitness Professionals", icon: "Dumbbell" },
        { label: "Organic Farming & Natural Product Buyers", icon: "Sprout" },
        { label: "Sustainable Packaging & Eco-friendly Brands", icon: "Flower2" },
        { label: "Investors, Franchise Seekers & Green Business", icon: "Handshake" },
        { label: "Supermarkets & Organic Grocery Chains", icon: "Users" },
        { label: "Health-Conscious Consumers & Eco-Enthusiasts", icon: "Heart" }
      ]
    }
  }
}, { timestamps: true });

const SponsorsAndAttend = mongoose.model("OrganicSponsorsAndAttend", sponsorsAndAttendSchema);
export default SponsorsAndAttend;
