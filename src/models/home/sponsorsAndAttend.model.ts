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
  enabled: { type: Boolean, default: true },
  titlePrefix: { type: String, default: 'WHY' },
  titleHighlight: { type: String, default: 'ATTEND?' },
  description: { 
    type: String, 
    default: 'Explore innovations, build connections and gain insights that drive better health and stronger businesses.' 
  },
  image: { type: String, default: '' },
  imageAlt: { type: String, default: 'Why Attend Bharat Organic Expo' },
  buttonLabel: { type: String, default: 'REGISTER AS VISITOR!' },
  buttonHref: { type: String, default: '/registration/visitor-registration' },

  feature1Title: { type: String, default: 'DISCOVER' },
  feature1Desc: { type: String, default: 'Explore the latest organic products and eco-friendly services driving a sustainable future.' },
  feature2Title: { type: String, default: 'LEARN' },
  feature2Desc: { type: String, default: 'Attend seminars, workshops and live demos by organic agriculture and sustainability experts.' },
  feature3Title: { type: String, default: 'CONNECT' },
  feature3Desc: { type: String, default: 'Meet leading organic brands, manufacturers and sustainable suppliers under one roof.' },
  feature4Title: { type: String, default: 'SOURCE' },
  feature4Desc: { type: String, default: 'Find trusted organic suppliers, distributors and eco-franchise opportunities.' },
  feature5Title: { type: String, default: 'GROW' },
  feature5Desc: { type: String, default: 'Unlock new green business opportunities, partnerships and eco-investment possibilities.' },
  feature6Title: { type: String, default: 'STAY AHEAD' },
  feature6Desc: { type: String, default: 'Stay updated with market trends, conscious consumer insights and future organic industry developments.' },

  keyPoint1: { type: String, default: 'Organic Distributors, Wholesalers & Retailers' },
  keyPoint2: { type: String, default: 'Eco-Importers & Exporters' },
  keyPoint3: { type: String, default: 'Ayurvedic Institutions & Wellness Centers' },
  keyPoint4: { type: String, default: 'Nutritionists, Farmers & Wellness Experts' },
  keyPoint5: { type: String, default: 'Gym Owners, Spa & Eco-Fitness Professionals' },
  keyPoint6: { type: String, default: 'Organic Farming & Natural Product Buyers' },
  keyPoint7: { type: String, default: 'Sustainable Packaging & Eco-friendly Brands' },
  keyPoint8: { type: String, default: 'Investors, Franchise Seekers & Green Business' },
  keyPoint9: { type: String, default: 'Supermarkets & Organic Grocery Chains' },
  keyPoint10: { type: String, default: 'Health-Conscious Consumers & Eco-Enthusiasts' },

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
