import WhyVisitMatters from "../../../../../models/participate/why_visit/whyVisitMatters.model";
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

export const getWhyVisitMattersService = async () => {
  let data = await WhyVisitMatters.findOne();
  if (!data) {
    data = await WhyVisitMatters.create({});
  }
  return data;
};

export const updateWhyVisitMattersService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await WhyVisitMatters.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createWhyVisitMattersService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await WhyVisitMatters.create(updateData);
};

export const getAllWhyVisitMattersService = async () => {
  return await WhyVisitMatters.find();
};

export const getWhyVisitMattersByIdService = async (id: string) => {
  const data = await WhyVisitMatters.findById(id);
  if (!data) throw ApiError.notFound("Why Visit Matters not found");
  return data;
};

export const updateWhyVisitMattersByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await WhyVisitMatters.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Why Visit Matters not found");
  return data;
};

export const deleteWhyVisitMattersByIdService = async (id: string) => {
  const data = await WhyVisitMatters.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Why Visit Matters not found");
  return data;
};
