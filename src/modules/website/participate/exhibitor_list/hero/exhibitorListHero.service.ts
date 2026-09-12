import ExhibitorListHero from "../../../../../models/participate/exhibitor_list/exhibitorListHero.model";
import { ApiError } from "../../../../../utils/ApiError";

const parseJsonFields = (payload: any, files?: any) => {
  const updateData = { ...payload };

  if (typeof updateData.buttons === "string") {
    try {
      updateData.buttons = JSON.parse(updateData.buttons);
    } catch {
      // keep as is
    }
  }

  if (files && files.bgImage && files.bgImage[0]) {
    updateData.bgImage = `/uploads/organic_expo/${files.bgImage[0].filename}`;
  }

  if (files && files.leafImage && files.leafImage[0]) {
    updateData.leafImage = `/uploads/organic_expo/${files.leafImage[0].filename}`;
  }

  return updateData;
};

export const getExhibitorListHeroService = async () => {
  let data = await ExhibitorListHero.findOne();
  if (!data) {
    data = await ExhibitorListHero.create({});
  }
  return data;
};

export const updateExhibitorListHeroService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await ExhibitorListHero.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createExhibitorListHeroService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await ExhibitorListHero.create(updateData);
};

export const getAllExhibitorListHeroService = async () => {
  return await ExhibitorListHero.find();
};

export const getExhibitorListHeroByIdService = async (id: string) => {
  const data = await ExhibitorListHero.findById(id);
  if (!data) throw ApiError.notFound("Exhibitor List Hero not found");
  return data;
};

export const updateExhibitorListHeroByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await ExhibitorListHero.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Exhibitor List Hero not found");
  return data;
};

export const deleteExhibitorListHeroByIdService = async (id: string) => {
  const data = await ExhibitorListHero.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Exhibitor List Hero not found");
  return data;
};
