import WhyExhibitStatsBand from "../../../../../models/participate/why_exhibit/whyExhibitStatsBand.model";
import { ApiError } from "../../../../../utils/ApiError";

const defaultStats = [
  { val: "8,000+", label: "VISITORS / DELEGATES", icon: "Users", iconName: "Users" },
  { val: "200+", label: "EXHIBITORS", icon: "Building2", iconName: "Building2" },
  { val: "1,000+", label: "GLOBAL BUYERS", icon: "Globe", iconName: "Globe" },
  { val: "65+", label: "EXPERT SPEAKERS", icon: "Mic", iconName: "Mic" },
  { val: "B2B", label: "MEETINGS", icon: "Handshake", iconName: "Handshake" },
];

export const getAllWhyExhibitStatsBandService = async () => {
  let stats = await WhyExhibitStatsBand.find();
  if (stats.length === 0) {
    stats = await WhyExhibitStatsBand.insertMany(defaultStats);
  }
  return stats;
};

export const updateAllWhyExhibitStatsBandService = async (payload: any) => {
  const items = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
  if (items.length > 0) {
    await WhyExhibitStatsBand.deleteMany({});
    return await WhyExhibitStatsBand.insertMany(
      items.map((it: any) => ({
        val: it.val || "",
        label: it.label || "",
        icon: it.icon || it.iconName || "Users",
        iconName: it.icon || it.iconName || "Users",
      }))
    );
  }
  return await WhyExhibitStatsBand.find();
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
