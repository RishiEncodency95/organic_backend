import OrganicSponsorshipBottom from "../../../../../models/opportunities/sponsorshipBottom.model";
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

export const getSponsorshipBottomService = async () => {
  let data = await OrganicSponsorshipBottom.findOne();
  if (!data) {
    data = await OrganicSponsorshipBottom.create({});
  }
  return data;
};

export const updateSponsorshipBottomService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicSponsorshipBottom.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createSponsorshipBottomService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await OrganicSponsorshipBottom.create(updateData);
};

export const getAllSponsorshipBottomService = async () => {
  return await OrganicSponsorshipBottom.find();
};

export const getSponsorshipBottomByIdService = async (id: string) => {
  const data = await OrganicSponsorshipBottom.findById(id);
  if (!data) throw ApiError.notFound("Sponsorship Bottom not found");
  return data;
};

export const updateSponsorshipBottomByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicSponsorshipBottom.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Sponsorship Bottom not found");
  return data;
};

export const deleteSponsorshipBottomByIdService = async (id: string) => {
  const data = await OrganicSponsorshipBottom.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Sponsorship Bottom not found");
  return data;
};
