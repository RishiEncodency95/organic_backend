import WhyVisitWhoShould from "../../../../../models/participate/why_visit/whyVisitWhoShould.model";
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

export const getWhyVisitWhoShouldService = async () => {
  let data = await WhyVisitWhoShould.findOne();
  if (!data) {
    data = await WhyVisitWhoShould.create({});
  }
  return data;
};

export const updateWhyVisitWhoShouldService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await WhyVisitWhoShould.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createWhyVisitWhoShouldService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await WhyVisitWhoShould.create(updateData);
};

export const getAllWhyVisitWhoShouldService = async () => {
  return await WhyVisitWhoShould.find();
};

export const getWhyVisitWhoShouldByIdService = async (id: string) => {
  const data = await WhyVisitWhoShould.findById(id);
  if (!data) throw ApiError.notFound("Why Visit Who Should not found");
  return data;
};

export const updateWhyVisitWhoShouldByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await WhyVisitWhoShould.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Why Visit Who Should not found");
  return data;
};

export const deleteWhyVisitWhoShouldByIdService = async (id: string) => {
  const data = await WhyVisitWhoShould.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Why Visit Who Should not found");
  return data;
};
