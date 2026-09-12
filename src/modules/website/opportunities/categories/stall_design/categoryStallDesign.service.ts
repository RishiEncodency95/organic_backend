import OrganicCategoryStallDesign from "../../../../../models/opportunities/categoryStallDesign.model";
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

export const getCategoryStallDesignService = async () => {
  let data = await OrganicCategoryStallDesign.findOne();
  if (!data) {
    data = await OrganicCategoryStallDesign.create({});
  }
  return data;
};

export const updateCategoryStallDesignService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicCategoryStallDesign.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createCategoryStallDesignService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await OrganicCategoryStallDesign.create(updateData);
};

export const getAllCategoryStallDesignService = async () => {
  return await OrganicCategoryStallDesign.find();
};

export const getCategoryStallDesignByIdService = async (id: string) => {
  const data = await OrganicCategoryStallDesign.findById(id);
  if (!data) throw ApiError.notFound("Category Stall Design not found");
  return data;
};

export const updateCategoryStallDesignByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicCategoryStallDesign.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Category Stall Design not found");
  return data;
};

export const deleteCategoryStallDesignByIdService = async (id: string) => {
  const data = await OrganicCategoryStallDesign.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Category Stall Design not found");
  return data;
};
