import WhyVisitAwards from "../../../../../models/participate/why_visit/whyVisitAwards.model";
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

export const getWhyVisitAwardsService = async () => {
  let data = await WhyVisitAwards.findOne();
  if (!data) {
    data = await WhyVisitAwards.create({});
  }
  return data;
};

export const updateWhyVisitAwardsService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await WhyVisitAwards.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createWhyVisitAwardsService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await WhyVisitAwards.create(updateData);
};

export const getAllWhyVisitAwardsService = async () => {
  return await WhyVisitAwards.find();
};

export const getWhyVisitAwardsByIdService = async (id: string) => {
  const data = await WhyVisitAwards.findById(id);
  if (!data) throw ApiError.notFound("Why Visit Awards not found");
  return data;
};

export const updateWhyVisitAwardsByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await WhyVisitAwards.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Why Visit Awards not found");
  return data;
};

export const deleteWhyVisitAwardsByIdService = async (id: string) => {
  const data = await WhyVisitAwards.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Why Visit Awards not found");
  return data;
};
