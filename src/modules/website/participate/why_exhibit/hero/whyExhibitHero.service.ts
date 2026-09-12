import WhyExhibitHero from "../../../../../models/participate/why_exhibit/whyExhibitHero.model";
import { ApiError } from "../../../../../utils/ApiError";

const parseJsonFields = (payload: any, files?: any) => {
  const updateData = { ...payload };

  ["highlights", "buttons", "eventCard"].forEach((field) => {
    if (typeof updateData[field] === "string") {
      try {
        updateData[field] = JSON.parse(updateData[field]);
      } catch {
        // keep as is
      }
    }
  });

  if (files && files.bgImage && files.bgImage[0]) {
    updateData.bgImage = `/uploads/organic_expo/${files.bgImage[0].filename}`;
  }

  return updateData;
};

export const getWhyExhibitHeroService = async () => {
  let data = await WhyExhibitHero.findOne();
  if (!data) {
    data = await WhyExhibitHero.create({});
  }
  return data;
};

export const updateWhyExhibitHeroService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await WhyExhibitHero.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createWhyExhibitHeroService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await WhyExhibitHero.create(updateData);
};

export const getAllWhyExhibitHeroService = async () => {
  return await WhyExhibitHero.find();
};

export const getWhyExhibitHeroByIdService = async (id: string) => {
  const data = await WhyExhibitHero.findById(id);
  if (!data) throw ApiError.notFound("Why Exhibit Hero not found");
  return data;
};

export const updateWhyExhibitHeroByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await WhyExhibitHero.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Why Exhibit Hero not found");
  return data;
};

export const deleteWhyExhibitHeroByIdService = async (id: string) => {
  const data = await WhyExhibitHero.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Why Exhibit Hero not found");
  return data;
};
