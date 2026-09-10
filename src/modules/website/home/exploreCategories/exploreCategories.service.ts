import ExploreCategories from "../../../../models/home/exploreCategories.model";
import { ApiError } from "../../../../utils/ApiError";

export const createExploreCategoryService = async (payload: any, file?: Express.Multer.File) => {
  const updateData = { ...payload };
  if (file) {
    updateData.logo = `/uploads/organic_expo/${file.filename}`;
  }
  return await ExploreCategories.create(updateData);
};

export const getAllExploreCategoriesService = async () => {
  return await ExploreCategories.find().sort({ createdAt: -1 });
};

export const getExploreCategoryByIdService = async (id: string) => {
  const data = await ExploreCategories.findById(id);
  if (!data) throw ApiError.notFound("Category not found");
  return data;
};

export const updateExploreCategoryByIdService = async (id: string, payload: any, file?: Express.Multer.File) => {
  const updateData = { ...payload };
  if (file) {
    updateData.logo = `/uploads/organic_expo/${file.filename}`;
  }
  const data = await ExploreCategories.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Category not found");
  return data;
};

export const deleteExploreCategoryByIdService = async (id: string) => {
  const data = await ExploreCategories.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Category not found");
  return data;
};
