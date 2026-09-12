import OrganicEPromotionHero from "../../../../../models/opportunities/epromotionHero.model";
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

export const getEPromotionHeroService = async () => {
  let data = await OrganicEPromotionHero.findOne();
  if (!data) {
    data = await OrganicEPromotionHero.create({});
  }
  return data;
};

export const updateEPromotionHeroService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicEPromotionHero.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createEPromotionHeroService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await OrganicEPromotionHero.create(updateData);
};

export const getAllEPromotionHeroService = async () => {
  return await OrganicEPromotionHero.find();
};

export const getEPromotionHeroByIdService = async (id: string) => {
  const data = await OrganicEPromotionHero.findById(id);
  if (!data) throw ApiError.notFound("E-Promotion Hero not found");
  return data;
};

export const updateEPromotionHeroByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicEPromotionHero.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("E-Promotion Hero not found");
  return data;
};

export const deleteEPromotionHeroByIdService = async (id: string) => {
  const data = await OrganicEPromotionHero.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("E-Promotion Hero not found");
  return data;
};
