import ExhibitorItem from "../../../../../models/participate/exhibitor_list/exhibitorItem.model";
import { ApiError } from "../../../../../utils/ApiError";

const SEED_EXHIBITORS = [
  { name: "THE WORLD OF MARĪCT", title: "THE WORLD OF MARĪCT", category: "ORGANIC FOOD", location: "India", order: 1, logo: "/exhibitors/1.jpg", image: "/exhibitors/1.jpg", altText: "THE WORLD OF MARĪCT Organic Food Exhibitor Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "9.3 KB" },
  { name: "SNOWFLAKZ", title: "SNOWFLAKZ", category: "ORGANIC FOOD", location: "India", order: 2, logo: "/exhibitors/2.jpg", image: "/exhibitors/2.jpg", altText: "SNOWFLAKZ Organic Expo Brand Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "13.8 KB" },
  { name: "The Pahari Life", title: "The Pahari Life", category: "ORGANIC FOOD", location: "Himachal Pradesh", order: 3, logo: "/exhibitors/3.jpg", image: "/exhibitors/3.jpg", altText: "The Pahari Life Natural Himalayan Organic Products Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "11.8 KB" },
  { name: "Heritiage Oils", title: "Heritiage Oils", category: "ORGANIC FOOD", location: "India", order: 4, logo: "/exhibitors/4.jpg", image: "/exhibitors/4.jpg", altText: "Heritage Oils Cold Pressed Cooking Oils Exhibitor Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "20.2 KB" },
  { name: "Tripti Natural Himachal", title: "Tripti Natural Himachal", category: "NATURAL CARE", location: "Himachal Pradesh", order: 5, logo: "/exhibitors/5.jpg", image: "/exhibitors/5.jpg", altText: "Tripti Natural Himachal Honey and Organic Care Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "17.1 KB" },
  { name: "FARMIYA ORGANICS", title: "FARMIYA ORGANICS", category: "AGRICULTURE", location: "India", order: 6, logo: "/exhibitors/6.jpg", image: "/exhibitors/6.jpg", altText: "FARMIYA ORGANICS Sustainable Agriculture Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "16.3 KB" },
  { name: "Saatwik Aaruyeda", title: "Saatwik Aaruyeda", category: "AYURVEDA", location: "India", order: 7, logo: "/exhibitors/7.jpg", image: "/exhibitors/7.jpg", altText: "Saatwik Ayurveda Traditional Herbal Products Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "12.7 KB" },
  { name: "The Himavan Essence", title: "The Himavan Essence", category: "AYURVEDA", location: "India", order: 8, logo: "/exhibitors/8.jpg", image: "/exhibitors/8.jpg", altText: "The Himavan Essence Essential Herbs and Oils Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "9.8 KB" },
  { name: "Prabhushree", title: "Prabhushree", category: "ORGANIC FOOD", location: "India", order: 9, logo: "/exhibitors/9.jpg", image: "/exhibitors/9.jpg", altText: "Prabhushree Pure Spices and Organic Foods Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "9.3 KB" },
  { name: "SPICES & HERBS", title: "SPICES & HERBS", category: "ORGANIC FOOD", location: "India", order: 10, logo: "/exhibitors/10.jpg", image: "/exhibitors/10.jpg", altText: "Van Vibhuti Spices and Herbs Natural Brand Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "11.4 KB" },
  { name: "Etbar", title: "Etbar", category: "NATURAL CARE", location: "India", order: 11, logo: "/exhibitors/11.jpg", image: "/exhibitors/11.jpg", altText: "Etbar The Purity You Can Trust Organic Care Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "12.7 KB" },
  { name: "Safe Agri", title: "Safe Agri", category: "AGRICULTURE", location: "India", order: 12, logo: "/exhibitors/12.jpg", image: "/exhibitors/12.jpg", altText: "Safe Agri Farm Science and Organic Farming Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "11.1 KB" },
  { name: "SHREE HARI", title: "SHREE HARI", category: "AYURVEDA", location: "India", order: 13, logo: "/exhibitors/13.jpg", image: "/exhibitors/13.jpg", altText: "Shree Hari Nursery and Raw Herbs Exhibitor Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "14.5 KB" },
  { name: "Ropuiliani", title: "Ropuiliani", category: "ORGANIC FOOD", location: "India", order: 14, logo: "/exhibitors/14.jpg", image: "/exhibitors/14.jpg", altText: "Ropuiliani Farmers Producer Company Limited Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "15.1 KB" },
  { name: "VEER FITNESS", title: "VEER FITNESS", category: "HEALTH & WELLNESS", location: "India", order: 15, logo: "/exhibitors/15.jpg", image: "/exhibitors/15.jpg", altText: "VEER FITNESS Health and Sports Wellness Brand Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "12.0 KB" },
  { name: "Pratham Pahal", title: "Pratham Pahal", category: "AGRICULTURE", location: "India", order: 16, logo: "/exhibitors/16.jpg", image: "/exhibitors/16.jpg", altText: "Pratham Pahal Medical and Agricultural Consultancy Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "12.5 KB" },
  { name: "V S Natural", title: "V S Natural", category: "NATURAL CARE", location: "India", order: 17, logo: "/exhibitors/17.jpg", image: "/exhibitors/17.jpg", altText: "V S Natural Agro Foods and Wellness Products Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "11.9 KB" },
  { name: "Viraj Agro Foods", title: "Viraj Agro Foods", category: "ORGANIC FOOD", location: "India", order: 18, logo: "/exhibitors/18.jpg", image: "/exhibitors/18.jpg", altText: "Viraj Agro Foods Cold Pressed Mustard Oil Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "17.4 KB" },
  { name: "CFEI", title: "CFEI", category: "AGRICULTURE", location: "India", order: 19, logo: "/exhibitors/19.jpg", image: "/exhibitors/19.jpg", altText: "CFEI Agri Cluster and Farmer Eco Initiative Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "13.8 KB" },
  { name: "PELLE NUDA", title: "PELLE NUDA", category: "NATURAL CARE", location: "India", order: 20, logo: "/exhibitors/20.jpg", image: "/exhibitors/20.jpg", altText: "PELLE NUDA Skincare with Purity Brand Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "14.1 KB" },
  { name: "Dadu Fresh", title: "Dadu Fresh", category: "ORGANIC FOOD", location: "India", order: 21, logo: "/exhibitors/21.jpg", image: "/exhibitors/21.jpg", altText: "Dadu Fresh Love Nature Stay Healthy Organic Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "42.5 KB" },
  { name: "Bhukranti", title: "Bhukranti", category: "AGRICULTURE", location: "India", order: 22, logo: "/exhibitors/22.jpg", image: "/exhibitors/22.jpg", altText: "Bhukranti Eco Friendly Soil Bio Fertilizer Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "98.5 KB" },
  { name: "Nutrelis", title: "Nutrelis", category: "HEALTH & WELLNESS", location: "India", order: 23, logo: "/exhibitors/23.jpg", image: "/exhibitors/23.jpg", altText: "Nutrelis Agro Food Natural Nutrition Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "70.2 KB" },
  { name: "Herbal Eco", title: "Herbal Eco", category: "AYURVEDA", location: "India", order: 24, logo: "/exhibitors/24.jpg", image: "/exhibitors/24.jpg", altText: "Herbal Eco Holistic Natural Wellness Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "40.5 KB" },
  { name: "Khasiyat", title: "Khasiyat", category: "ORGANIC FOOD", location: "India", order: 25, logo: "/exhibitors/25.jpg", image: "/exhibitors/25.jpg", altText: "Khasiyat Traditional Taste Organic Food Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "40.8 KB" },
  { name: "Shree Ratnam", title: "Shree Ratnam", category: "AYURVEDA", location: "India", order: 26, logo: "/exhibitors/26.jpg", image: "/exhibitors/26.jpg", altText: "Shree Ratnam Herbal and Ayurveda Remedies Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "19.5 KB" },
  { name: "Star Holo India", title: "Star Holo India", category: "OTHERS", location: "India", order: 27, logo: "/exhibitors/27.jpg", image: "/exhibitors/27.jpg", altText: "Star Holo India Organic Security Packaging Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "48.8 KB" },
  { name: "Baiso Organics", title: "Baiso Organics", category: "ORGANIC FOOD", location: "India", order: 28, logo: "/exhibitors/28.jpg", image: "/exhibitors/28.jpg", altText: "Baiso Organics Farm Fresh Products Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "51.4 KB" },
  { name: "Kaki maa", title: "Kaki maa", category: "ORGANIC FOOD", location: "India", order: 29, logo: "/exhibitors/29.jpg", image: "/exhibitors/29.jpg", altText: "Kaki Maa Desi Achar and Organic Condiments Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "56.5 KB" },
  { name: "Moorahav Organic", title: "Moorahav Organic", category: "AGRICULTURE", location: "India", order: 30, logo: "/exhibitors/30.jpg", image: "/exhibitors/30.jpg", altText: "Moorahav Organic Sustainable Crop Solutions Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "10.4 KB" },
  { name: "Mohan Ghee", title: "Mohan Ghee", category: "ORGANIC FOOD", location: "India", order: 31, logo: "/exhibitors/31.jpg", image: "/exhibitors/31.jpg", altText: "Mohan Ghee Traditional Bilona Cow Ghee Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "11.1 KB" },
  { name: "Shabari Naturals", title: "Shabari Naturals", category: "NATURAL CARE", location: "India", order: 32, logo: "/exhibitors/32.jpg", image: "/exhibitors/32.jpg", altText: "Shabari Naturals Tribal and Forest Organic Produce Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "14.2 KB" },
  { name: "Raheja Solar Food Processing pvt. ltd", title: "Raheja Solar Food Processing pvt. ltd", category: "AGRICULTURE", location: "India", order: 33, logo: "/exhibitors/33.jpg", image: "/exhibitors/33.jpg", altText: "Raheja Solar Food Processing Solar Dryers Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "39.0 KB" },
  { name: "Shanara", title: "Shanara", category: "NATURAL CARE", location: "India", order: 34, logo: "/exhibitors/34.jpg", image: "/exhibitors/34.jpg", altText: "Shanara Herbal Beauty and Care Products Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "27.2 KB" },
  { name: "Good And Grow", title: "Good And Grow", category: "AGRICULTURE", location: "India", order: 35, logo: "/exhibitors/35.jpg", image: "/exhibitors/35.jpg", altText: "Good And Grow Bio Plant Boosters Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "25.6 KB" },
  { name: "E-Bio-Cares", title: "E-Bio-Cares", category: "AYURVEDA", location: "India", order: 36, logo: "/exhibitors/36.jpg", image: "/exhibitors/36.jpg", altText: "E-Bio-Cares Natural Health Solutions Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "17.3 KB" },
  { name: "Panchtattav foods Pvt Ltd", title: "Panchtattav foods Pvt Ltd", category: "ORGANIC FOOD", location: "India", order: 37, logo: "/exhibitors/37.jpg", image: "/exhibitors/37.jpg", altText: "Panchtattav Foods Vedic Nutrition Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "33.5 KB" },
  { name: "Sharekhan", title: "Sharekhan", category: "OTHERS", location: "India", order: 38, logo: "/exhibitors/38.jpg", image: "/exhibitors/38.jpg", altText: "Sharekhan Agri Trade and Commodity Services Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "18.4 KB" },
  { name: "Bhartiye Crafts", title: "Bhartiye Crafts", category: "OTHERS", location: "India", order: 39, logo: "/exhibitors/39.jpg", image: "/exhibitors/39.jpg", altText: "Bhartiye Crafts Eco Handicrafts and Natural Utensils Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "13.6 KB" },
  { name: "Vinayak Group", title: "Vinayak Group", category: "AGRICULTURE", location: "India", order: 40, logo: "/exhibitors/40.jpg", image: "/exhibitors/40.jpg", altText: "Vinayak Group Farm Mechanization and Supplies Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "9.5 KB" },
  { name: "Sri Yamuna Essence", title: "Sri Yamuna Essence", category: "AYURVEDA", location: "India", order: 41, logo: "/exhibitors/41.jpg", image: "/exhibitors/41.jpg", altText: "Sri Yamuna Essence Natural Fragrance and Oils Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "11.2 KB" },
  { name: "Kajah Balm & Oil", title: "Kajah Balm & Oil", category: "AYURVEDA", location: "India", order: 42, logo: "/exhibitors/42.jpg", image: "/exhibitors/42.jpg", altText: "Kajah Balm & Oil Herbal Pain Relief Formula Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "15.4 KB" },
  { name: "Soultatva", title: "Soultatva", category: "ORGANIC FOOD", location: "India", order: 43, logo: "/exhibitors/43.jpg", image: "/exhibitors/43.jpg", altText: "Soultatva Superfoods Seeds and Nuts Brand Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "15.9 KB" },
  { name: "Shroonius", title: "Shroonius", category: "ORGANIC FOOD", location: "India", order: 44, logo: "/exhibitors/44.jpg", image: "/exhibitors/44.jpg", altText: "Shroonius Mushroom and Functional Foods Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "11.8 KB" },
  { name: "Skyrr Up", title: "Skyrr Up", category: "HEALTH & WELLNESS", location: "India", order: 45, logo: "/exhibitors/45.jpg", image: "/exhibitors/45.jpg", altText: "Skyrr Up High Protein Dairy and Wellness Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "24.9 KB" },
  { name: "Achyutam Aahar", title: "Achyutam Aahar", category: "ORGANIC FOOD", location: "India", order: 46, logo: "/exhibitors/46.jpg", image: "/exhibitors/46.jpg", altText: "Achyutam Aahar Pure Organic Flour and Millets Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "38.3 KB" },
  { name: "Grunwald", title: "Grunwald", category: "OTHERS", location: "India", order: 47, logo: "/exhibitors/47.jpg", image: "/exhibitors/47.jpg", altText: "Grunwald Packaging and Sustainable Machinery Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "15.8 KB" },
  { name: "Viridian", title: "Viridian", category: "AYURVEDA", location: "India", order: 48, logo: "/exhibitors/48.jpg", image: "/exhibitors/48.jpg", altText: "Viridian Pure Botanical Extract Nutrition Logo", status: "Published", updatedAt: new Date(), updatedBy: "Vansh Chaudhary", fileSize: "3.2 KB" },
];

const parseJsonFields = (payload: any, files?: any) => {
  const updateData = { ...payload };

  if (files && files.image && files.image[0]) {
    updateData.image = `/uploads/organic_expo/${files.image[0].filename}`;
    updateData.logo = updateData.image;
  }

  // Sync title and name
  if (updateData.name && !updateData.title) {
    updateData.title = updateData.name;
  } else if (updateData.title && !updateData.name) {
    updateData.name = updateData.title;
  }

  // Sync logo and image
  if (updateData.logo && !updateData.image) {
    updateData.image = updateData.logo;
  } else if (updateData.image && !updateData.logo) {
    updateData.logo = updateData.image;
  }

  if (updateData.order !== undefined && updateData.order !== null) {
    updateData.order = Number(updateData.order);
  }

  return updateData;
};

export const getAllExhibitorItemsService = async () => {
  const count = await ExhibitorItem.countDocuments();
  if (count === 0) {
    // Auto-seed initial 48 exhibitors
    await ExhibitorItem.insertMany(SEED_EXHIBITORS);
  }
  return await ExhibitorItem.find().sort({ order: 1, createdAt: 1 });
};

export const createExhibitorItemService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);

  if (updateData.order === undefined || isNaN(updateData.order)) {
    const highestItem = await ExhibitorItem.findOne().sort({ order: -1 });
    updateData.order = highestItem && typeof highestItem.order === "number" ? highestItem.order + 1 : 1;
  }

  if (!updateData.title) {
    updateData.title = updateData.name || "Exhibitor";
    updateData.name = updateData.title;
  }
  if (!updateData.image) {
    updateData.image = updateData.logo || "/exhibitors/1.jpg";
    updateData.logo = updateData.image;
  }
  if (!updateData.altText) {
    updateData.altText = `${updateData.title} Brand Logo`;
  }
  if (!updateData.status) {
    updateData.status = "Published";
  }

  return await ExhibitorItem.create(updateData);
};

import mongoose from "mongoose";

const getQueryForId = (id: string) => {
  if (mongoose.Types.ObjectId.isValid(id)) {
    return { _id: id };
  }
  const cleanId = id.startsWith("ex") ? id.replace("ex", "") : id;
  const parsed = parseInt(cleanId, 10);
  if (!isNaN(parsed)) {
    return { order: parsed };
  }
  return { _id: id };
};

export const getExhibitorItemByIdService = async (id: string) => {
  const query = getQueryForId(id);
  const data = await ExhibitorItem.findOne(query);
  if (!data) throw ApiError.notFound("Exhibitor item not found");
  return data;
};

export const updateExhibitorItemByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const query = getQueryForId(id);
  const data = await ExhibitorItem.findOneAndUpdate(query, updateData, { new: true });
  if (!data) throw ApiError.notFound("Exhibitor item not found");
  return data;
};

export const deleteExhibitorItemByIdService = async (id: string) => {
  const query = getQueryForId(id);
  const data = await ExhibitorItem.findOneAndDelete(query);
  if (!data) throw ApiError.notFound("Exhibitor item not found");
  return data;
};

