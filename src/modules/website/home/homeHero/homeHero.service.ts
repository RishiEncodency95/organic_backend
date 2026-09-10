import HomeHero from "../../../../models/home/homeHero.model";
import { ApiError } from "../../../../utils/ApiError";

export const createHomeHeroService = async (payload: any, file?: Express.Multer.File) => {
  const updateData = { ...payload };
  if (file) {
    updateData.img = `/uploads/organic_expo/${file.filename}`;
  }
  return await HomeHero.create(updateData);
};

export const getAllHomeHeroService = async () => {
  return await HomeHero.find().sort({ createdAt: -1 });
};

export const getHomeHeroByIdService = async (id: string) => {
  const data = await HomeHero.findById(id);
  if (!data) throw ApiError.notFound("Home Hero banner not found");
  return data;
};

export const updateHomeHeroByIdService = async (id: string, payload: any, file?: Express.Multer.File) => {
  const updateData = { ...payload };
  if (file) {
    updateData.img = `/uploads/organic_expo/${file.filename}`;
  }
  const data = await HomeHero.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Home Hero banner not found");
  return data;
};

export const deleteHomeHeroByIdService = async (id: string) => {
  const data = await HomeHero.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Home Hero banner not found");
  return data;
};
