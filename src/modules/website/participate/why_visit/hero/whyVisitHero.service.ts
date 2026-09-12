import WhyVisitHero from "../../../../../models/participate/why_visit/whyVisitHero.model";
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

export const getWhyVisitHeroService = async () => {
  let data = await WhyVisitHero.findOne();
  if (!data) {
    data = await WhyVisitHero.create({});
  }
  return data;
};

export const updateWhyVisitHeroService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await WhyVisitHero.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createWhyVisitHeroService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await WhyVisitHero.create(updateData);
};

export const getAllWhyVisitHeroService = async () => {
  return await WhyVisitHero.find();
};

export const getWhyVisitHeroByIdService = async (id: string) => {
  const data = await WhyVisitHero.findById(id);
  if (!data) throw ApiError.notFound("Why Visit Hero not found");
  return data;
};

export const updateWhyVisitHeroByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await WhyVisitHero.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Why Visit Hero not found");
  return data;
};

export const deleteWhyVisitHeroByIdService = async (id: string) => {
  const data = await WhyVisitHero.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Why Visit Hero not found");
  return data;
};
