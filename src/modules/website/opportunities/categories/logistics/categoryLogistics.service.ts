import OrganicCategoryLogistics from "../../../../../models/opportunities/categoryLogistics.model";
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

export const getCategoryLogisticsService = async () => {
  let data = await OrganicCategoryLogistics.findOne();
  if (!data) {
    data = await OrganicCategoryLogistics.create({});
  }
  return data;
};

export const updateCategoryLogisticsService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicCategoryLogistics.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createCategoryLogisticsService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await OrganicCategoryLogistics.create(updateData);
};

export const getAllCategoryLogisticsService = async () => {
  return await OrganicCategoryLogistics.find();
};

export const getCategoryLogisticsByIdService = async (id: string) => {
  const data = await OrganicCategoryLogistics.findById(id);
  if (!data) throw ApiError.notFound("Category Logistics not found");
  return data;
};

export const updateCategoryLogisticsByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicCategoryLogistics.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Category Logistics not found");
  return data;
};

export const deleteCategoryLogisticsByIdService = async (id: string) => {
  const data = await OrganicCategoryLogistics.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Category Logistics not found");
  return data;
};
