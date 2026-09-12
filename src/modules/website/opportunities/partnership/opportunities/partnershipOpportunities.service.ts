import OrganicPartnershipOpportunities from "../../../../../models/opportunities/partnershipOpportunities.model";
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

export const getPartnershipOpportunitiesService = async () => {
  let data = await OrganicPartnershipOpportunities.findOne();
  if (!data) {
    data = await OrganicPartnershipOpportunities.create({});
  }
  return data;
};

export const updatePartnershipOpportunitiesService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicPartnershipOpportunities.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createPartnershipOpportunitiesService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await OrganicPartnershipOpportunities.create(updateData);
};

export const getAllPartnershipOpportunitiesService = async () => {
  return await OrganicPartnershipOpportunities.find();
};

export const getPartnershipOpportunitiesByIdService = async (id: string) => {
  const data = await OrganicPartnershipOpportunities.findById(id);
  if (!data) throw ApiError.notFound("Partnership Opportunities not found");
  return data;
};

export const updatePartnershipOpportunitiesByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicPartnershipOpportunities.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Partnership Opportunities not found");
  return data;
};

export const deletePartnershipOpportunitiesByIdService = async (id: string) => {
  const data = await OrganicPartnershipOpportunities.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Partnership Opportunities not found");
  return data;
};
