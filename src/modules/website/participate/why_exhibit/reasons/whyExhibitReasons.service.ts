import WhyExhibitReasons from "../../../../../models/participate/why_exhibit/whyExhibitReasons.model";
import { ApiError } from "../../../../../utils/ApiError";

const parseJsonFields = (payload: any, files?: any) => {
  const updateData = { ...payload };

  ["descLines", "points"].forEach((field) => {
    if (typeof updateData[field] === "string") {
      try {
        updateData[field] = JSON.parse(updateData[field]);
      } catch {
        // keep as is
      }
    }
  });

  if (files && files.img && files.img[0]) {
    updateData.img = `/uploads/organic_expo/${files.img[0].filename}`;
  }

  return updateData;
};

const defaultReasons = [
  {
    image: "/uploads/icons/11og.webp",
    img: "/uploads/icons/11og.webp",
    title1: "GLOBAL",
    title2: "BUYER ACCESS",
    description: "Meet thousands of qualified buyers, importers, distributors and decision-makers from around the world.",
    descLines: ["Meet thousands of qualified buyers, importers, distributors and decision-makers from around the world."],
    feature1: "Access new global markets",
    feature2: "Connect with key buyers",
    feature3: "Increase international reach",
    features: ["Access new global markets", "Connect with key buyers", "Increase international reach"],
    points: ["Access new global markets", "Connect with key buyers", "Increase international reach"],
  },
  {
    image: "/uploads/icons/12og.webp",
    img: "/uploads/icons/12og.webp",
    title1: "MAXIMUM BRAND",
    title2: "VISIBILITY",
    description: "Showcase your brand to a highly targeted audience and stand out in the competitive market.",
    descLines: ["Showcase your brand to a highly targeted audience and stand out in the competitive market."],
    feature1: "High brand recall",
    feature2: "Media & PR exposure",
    feature3: "Digital promotions",
    features: ["High brand recall", "Media & PR exposure", "Digital promotions"],
    points: ["High brand recall", "Media & PR exposure", "Digital promotions"],
  },
  {
    image: "/uploads/icons/13og.webp",
    img: "/uploads/icons/13og.webp",
    title1: "EXPAND YOUR",
    title2: "NETWORK",
    description: "Build valuable connections with industry leaders, partners and potential collaborators.",
    descLines: ["Build valuable connections with industry leaders, partners and potential collaborators."],
    feature1: "New partnerships",
    feature2: "Business alliances",
    feature3: "Long-term relationships",
    features: ["New partnerships", "Business alliances", "Long-term relationships"],
    points: ["New partnerships", "Business alliances", "Long-term relationships"],
  },
  {
    image: "/uploads/icons/14og.webp",
    img: "/uploads/icons/14og.webp",
    title1: "LAUNCH & SHOWCASE",
    title2: "INNOVATIONS",
    description: "Introduce new organic products, technologies and solutions to the right audience.",
    descLines: ["Introduce new organic products, technologies and solutions to the right audience."],
    feature1: "Product launches",
    feature2: "Live demonstrations",
    feature3: "Market validation",
    features: ["Product launches", "Live demonstrations", "Market validation"],
    points: ["Product launches", "Live demonstrations", "Market validation"],
  },
  {
    image: "/uploads/icons/15og.webp",
    img: "/uploads/icons/15og.webp",
    title1: "B2B MATCHMAKING",
    title2: "& MEETINGS",
    description: "Pre-scheduled B2B meetings to generate quality leads and new business.",
    descLines: ["Pre-scheduled B2B meetings to generate quality leads and new business."],
    feature1: "One-to-one meetings",
    feature2: "Targeted matchmaking",
    feature3: "Better conversions",
    features: ["One-to-one meetings", "Targeted matchmaking", "Better conversions"],
    points: ["One-to-one meetings", "Targeted matchmaking", "Better conversions"],
  },
  {
    image: "/uploads/icons/i6.png",
    img: "/uploads/icons/i6.png",
    title1: "BOOST SALES &",
    title2: "BUSINESS GROWTH",
    description: "Explore new markets, increase exports and drive long-term business growth.",
    descLines: ["Explore new markets, increase exports and drive long-term business growth."],
    feature1: "Increase revenue",
    feature2: "Expand customer base",
    feature3: "Sustainable growth",
    features: ["Increase revenue", "Expand customer base", "Sustainable growth"],
    points: ["Increase revenue", "Expand customer base", "Sustainable growth"],
  },
];

export const getAllWhyExhibitReasonsService = async () => {
  let reasons = await WhyExhibitReasons.find();
  if (reasons.length === 0) {
    reasons = await WhyExhibitReasons.insertMany(defaultReasons);
  }
  return reasons;
};

export const updateAllWhyExhibitReasonsService = async (payload: any) => {
  const items = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
  if (items.length > 0) {
    await WhyExhibitReasons.deleteMany({});
    return await WhyExhibitReasons.insertMany(
      items.map((it: any, idx: number) => {
        const fallback = defaultReasons[idx % defaultReasons.length];
        const rawImg = it.image || it.img || fallback.image;
        const featList = [it.feature1, it.feature2, it.feature3].filter((f) => f && typeof f === "string" && f.trim() !== "");
        const rawFeatures = featList.length > 0
          ? featList
          : Array.isArray(it.features) && it.features.length > 0
          ? it.features
          : Array.isArray(it.points) && it.points.length > 0
          ? it.points
          : typeof it.features === "string" && it.features.trim() !== ""
          ? it.features.split(",").map((s: string) => s.trim()).filter(Boolean)
          : fallback.features;
        const rawDesc = it.description !== undefined && it.description !== "" ? it.description : fallback.description;

        return {
          image: rawImg,
          img: rawImg,
          title1: it.title1 || fallback.title1,
          title2: it.title2 !== undefined ? it.title2 : fallback.title2,
          description: rawDesc,
          descLines: [rawDesc],
          feature1: it.feature1 || rawFeatures[0] || "",
          feature2: it.feature2 || rawFeatures[1] || "",
          feature3: it.feature3 || rawFeatures[2] || "",
          features: rawFeatures,
          points: rawFeatures,
        };
      })
    );
  }
  return await WhyExhibitReasons.find();
};

export const createWhyExhibitReasonsService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await WhyExhibitReasons.create(updateData);
};

export const getWhyExhibitReasonsByIdService = async (id: string) => {
  const data = await WhyExhibitReasons.findById(id);
  if (!data) throw ApiError.notFound("Reason item not found");
  return data;
};

export const updateWhyExhibitReasonsByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await WhyExhibitReasons.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Reason item not found");
  return data;
};

export const deleteWhyExhibitReasonsByIdService = async (id: string) => {
  const data = await WhyExhibitReasons.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Reason item not found");
  return data;
};
