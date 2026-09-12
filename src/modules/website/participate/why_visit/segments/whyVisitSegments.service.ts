import WhyVisitSegments from "../../../../../models/participate/why_visit/whyVisitSegments.model";
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

export const getWhyVisitSegmentsService = async () => {
  let data = await WhyVisitSegments.findOne();
  if (!data) {
    data = await WhyVisitSegments.create({});
  }
  return data;
};

export const updateWhyVisitSegmentsService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await WhyVisitSegments.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createWhyVisitSegmentsService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await WhyVisitSegments.create(updateData);
};

export const getAllWhyVisitSegmentsService = async () => {
  return await WhyVisitSegments.find();
};

export const getWhyVisitSegmentsByIdService = async (id: string) => {
  const data = await WhyVisitSegments.findById(id);
  if (!data) throw ApiError.notFound("Why Visit Segments not found");
  return data;
};

export const updateWhyVisitSegmentsByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await WhyVisitSegments.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Why Visit Segments not found");
  return data;
};

export const deleteWhyVisitSegmentsByIdService = async (id: string) => {
  const data = await WhyVisitSegments.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Why Visit Segments not found");
  return data;
};
