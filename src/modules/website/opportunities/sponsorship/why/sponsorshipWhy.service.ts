import OrganicSponsorshipWhy from "../../../../../models/opportunities/sponsorshipWhy.model";
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

export const getSponsorshipWhyService = async () => {
  let data = await OrganicSponsorshipWhy.findOne();
  if (!data) {
    data = await OrganicSponsorshipWhy.create({});
  }
  return data;
};

export const updateSponsorshipWhyService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicSponsorshipWhy.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createSponsorshipWhyService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await OrganicSponsorshipWhy.create(updateData);
};

export const getAllSponsorshipWhyService = async () => {
  return await OrganicSponsorshipWhy.find();
};

export const getSponsorshipWhyByIdService = async (id: string) => {
  const data = await OrganicSponsorshipWhy.findById(id);
  if (!data) throw ApiError.notFound("Sponsorship Why not found");
  return data;
};

export const updateSponsorshipWhyByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicSponsorshipWhy.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Sponsorship Why not found");
  return data;
};

export const deleteSponsorshipWhyByIdService = async (id: string) => {
  const data = await OrganicSponsorshipWhy.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Sponsorship Why not found");
  return data;
};
