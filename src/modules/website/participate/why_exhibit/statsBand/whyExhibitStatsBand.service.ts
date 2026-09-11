import WhyExhibitStatsBand from "../../../../../models/participate/why_exhibit/whyExhibitStatsBand.model";
import { ApiError } from "../../../../../utils/ApiError";

const defaultStats = [
  { val: "8,000+", label: "VISITORS / DELEGATES", iconName: "Users" },
  { val: "200+", label: "EXHIBITORS", iconName: "Building2" },
  { val: "1,000+", label: "GLOBAL BUYERS", iconName: "Globe" },
  { val: "65+", label: "EXPERT SPEAKERS", iconName: "Mic" },
  { val: "B2B", label: "MEETINGS", iconName: "Handshake" },
];

export const getAllWhyExhibitStatsBandService = async () => {
  let stats = await WhyExhibitStatsBand.find();
  if (stats.length === 0) {
    stats = await WhyExhibitStatsBand.insertMany(defaultStats);
  }
  return stats;
};

export const createWhyExhibitStatsBandService = async (payload: any) => {
  return await WhyExhibitStatsBand.create(payload);
};

export const getWhyExhibitStatsBandByIdService = async (id: string) => {
  const data = await WhyExhibitStatsBand.findById(id);
  if (!data) throw ApiError.notFound("Stat item not found");
  return data;
};

export const updateWhyExhibitStatsBandByIdService = async (id: string, payload: any) => {
  const data = await WhyExhibitStatsBand.findByIdAndUpdate(id, payload, { new: true });
  if (!data) throw ApiError.notFound("Stat item not found");
  return data;
};

export const deleteWhyExhibitStatsBandByIdService = async (id: string) => {
  const data = await WhyExhibitStatsBand.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Stat item not found");
  return data;
};
