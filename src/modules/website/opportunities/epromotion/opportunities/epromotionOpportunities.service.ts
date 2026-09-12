import OrganicEPromotionOpportunities from "../../../../../models/opportunities/epromotionOpportunities.model";
import { ApiError } from "../../../../../utils/ApiError";

const parseJsonFields = (payload: any, files?: any) => {
  const updateData = { ...payload };

  Object.keys(updateData).forEach((key) => {
    if (typeof updateData[key] === "string") {
      try {
        updateData[key] = JSON.parse(updateData[key]);
      } catch {
        // keep string
      }
    }
  });

  if (files) {
    Object.keys(files).forEach((fieldname) => {
      if (files[fieldname] && files[fieldname][0]) {
        updateData[fieldname] = `/uploads/organic_expo/${files[fieldname][0].filename}`;
      }
    });
  }

  return updateData;
};

export const getEPromotionOpportunitiesService = async () => {
  let data = await OrganicEPromotionOpportunities.findOne();
  if (!data) {
    data = await OrganicEPromotionOpportunities.create({});
  }
  return data;
};

export const updateEPromotionOpportunitiesService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicEPromotionOpportunities.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createEPromotionOpportunitiesService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await OrganicEPromotionOpportunities.create(updateData);
};

export const getAllEPromotionOpportunitiesService = async () => {
  return await OrganicEPromotionOpportunities.find();
};

export const getEPromotionOpportunitiesByIdService = async (id: string) => {
  const data = await OrganicEPromotionOpportunities.findById(id);
  if (!data) throw ApiError.notFound("E-Promotion Opportunities not found");
  return data;
};

export const updateEPromotionOpportunitiesByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicEPromotionOpportunities.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("E-Promotion Opportunities not found");
  return data;
};

export const deleteEPromotionOpportunitiesByIdService = async (id: string) => {
  const data = await OrganicEPromotionOpportunities.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("E-Promotion Opportunities not found");
  return data;
};
