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

export const getAllWhyExhibitReasonsService = async () => {
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
