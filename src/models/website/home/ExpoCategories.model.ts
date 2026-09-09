import mongoose, { Document, Schema } from "mongoose";

const categorySchema = new Schema({
  icon: { type: String, default: '' },
  title: { type: String, default: '' },
  desc: { type: String, default: '' },
  color: { type: String, default: '' },
  image: { type: String, default: '' },
  imageAlt: { type: String, default: '' }
}, { _id: false });

const expoCategoriesSchema = new Schema({
  sectionTag: { type: String, default: 'Expo Categories' },
  titleMain: { type: String, default: 'Explore Diverse' },
  titleHighlight: { type: String, default: 'Exhibition Sectors' },
  descriptionPrefix: { type: String, default: 'One Platform. Every Opportunity.' },
  description: { 
    type: String, 
    default: ' Bharat Organic Expo brings together the entire organic ecosystem under one roof. Explore a wide range of sectors driving sustainable living, natural wellness, ethical production and global trade.' 
  },
  exploreText: { type: String, default: 'Explore' },
  buttonText: { type: String, default: 'VIEW ALL CATEGORIES' },
  categories: { 
    type: [categorySchema], 
    default: [
      { icon: "Apple", title: "Organic Food & Beverages", desc: "Wide range of certified organic foods, beverages, healthy snacks, grains, pulses, and ingredients.", color: "#4ade80", image: "", imageAlt: "Organic Food" },
      { icon: "Leaf", title: "AYUSH, Ayurveda & Herba", desc: "Ayurvedic medicines, herbal supplements, essential oils, teas, wellness products and holistic solutions.", color: "#14b8a6", image: "", imageAlt: "Ayurveda" },
      { icon: "Sprout", title: "Organic Natural Farming", desc: "Natural farming practices, organic cultivation methods, innovations and farm-to-market solutions.", color: "#22c55e", image: "", imageAlt: "Farming" },
      { icon: "Package", title: "Organic Inputs, Seeds & Bio- Inputs", desc: "Bio-fertilisers, organic manures, soil enhancers, pesticides and high-quality seeds.", color: "#fb923c", image: "", imageAlt: "Seeds" },
      { icon: "Milk", title: "Dairy, Livestock & Allied", desc: "Organic dairy products, livestock nutrition, animal health solutions and sustainable practices.", color: "#f472b6", image: "", imageAlt: "Dairy" },
      { icon: "Droplet", title: "Natural Beauty & Personal Care", desc: "Herbal skincare, haircare, personal care and eco-friendly beauty products.", color: "#60a5fa", image: "", imageAlt: "Beauty" },
      { icon: "Pill", title: "Nutraceuticals & Functional Nutrition", desc: "Dietary supplements, functional foods, immunity boosters and wellness nutrition products.", color: "#34d399", image: "", imageAlt: "Nutrition" },
      { icon: "Box", title: "Sustainable Packaging & Processing", desc: "Eco-friendly, biodegradable, recyclable and sustainable packaging solutions.", color: "#3b82f6", image: "", imageAlt: "Packaging" },
      { icon: "Tractor", title: "AgriTech, GreenTech & Innovation", desc: "Innovative agri technologies, smart farming, irrigation, farm mechanization and digital solutions.", color: "#10b981", image: "", imageAlt: "AgriTech" },
      { icon: "Globe", title: "Certification, Export, Trade & Services", desc: "Exporters, importers, trade associations and global business opportunities for organic products.", color: "#f59e0b", image: "", imageAlt: "Services" }
    ]
  }
}, { timestamps: true });

const ExpoCategories = mongoose.model("OrganicExpoCategories", expoCategoriesSchema);
export default ExpoCategories;
