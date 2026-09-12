import WhyVisitSupport from "../../../../../models/participate/why_visit/whyVisitSupport.model";
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

export const getWhyVisitSupportService = async () => {
  let data = await WhyVisitSupport.findOne();
  if (!data) {
    data = await WhyVisitSupport.create({});
  }
  return data;
};

export const updateWhyVisitSupportService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await WhyVisitSupport.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createWhyVisitSupportService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await WhyVisitSupport.create(updateData);
};

export const getAllWhyVisitSupportService = async () => {
  return await WhyVisitSupport.find();
};

export const getWhyVisitSupportByIdService = async (id: string) => {
  const data = await WhyVisitSupport.findById(id);
  if (!data) throw ApiError.notFound("Why Visit Support not found");
  return data;
};

export const updateWhyVisitSupportByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await WhyVisitSupport.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Why Visit Support not found");
  return data;
};

export const deleteWhyVisitSupportByIdService = async (id: string) => {
  const data = await WhyVisitSupport.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Why Visit Support not found");
  return data;
};
