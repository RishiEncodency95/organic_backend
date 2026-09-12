import OrganicCategoryPrintingBranding from "../../../../../models/opportunities/categoryPrintingBranding.model";
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

export const getCategoryPrintingBrandingService = async () => {
  let data = await OrganicCategoryPrintingBranding.findOne();
  if (!data) {
    data = await OrganicCategoryPrintingBranding.create({});
  }
  return data;
};

export const updateCategoryPrintingBrandingService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicCategoryPrintingBranding.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createCategoryPrintingBrandingService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await OrganicCategoryPrintingBranding.create(updateData);
};

export const getAllCategoryPrintingBrandingService = async () => {
  return await OrganicCategoryPrintingBranding.find();
};

export const getCategoryPrintingBrandingByIdService = async (id: string) => {
  const data = await OrganicCategoryPrintingBranding.findById(id);
  if (!data) throw ApiError.notFound("Category Printing & Branding not found");
  return data;
};

export const updateCategoryPrintingBrandingByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicCategoryPrintingBranding.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Category Printing & Branding not found");
  return data;
};

export const deleteCategoryPrintingBrandingByIdService = async (id: string) => {
  const data = await OrganicCategoryPrintingBranding.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Category Printing & Branding not found");
  return data;
};
