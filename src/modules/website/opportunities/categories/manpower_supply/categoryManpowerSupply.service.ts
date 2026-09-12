import OrganicCategoryManpowerSupply from "../../../../../models/opportunities/categoryManpowerSupply.model";
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

export const getCategoryManpowerSupplyService = async () => {
  let data = await OrganicCategoryManpowerSupply.findOne();
  if (!data) {
    data = await OrganicCategoryManpowerSupply.create({});
  }
  return data;
};

export const updateCategoryManpowerSupplyService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicCategoryManpowerSupply.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createCategoryManpowerSupplyService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await OrganicCategoryManpowerSupply.create(updateData);
};

export const getAllCategoryManpowerSupplyService = async () => {
  return await OrganicCategoryManpowerSupply.find();
};

export const getCategoryManpowerSupplyByIdService = async (id: string) => {
  const data = await OrganicCategoryManpowerSupply.findById(id);
  if (!data) throw ApiError.notFound("Category Manpower Supply not found");
  return data;
};

export const updateCategoryManpowerSupplyByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicCategoryManpowerSupply.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Category Manpower Supply not found");
  return data;
};

export const deleteCategoryManpowerSupplyByIdService = async (id: string) => {
  const data = await OrganicCategoryManpowerSupply.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Category Manpower Supply not found");
  return data;
};
