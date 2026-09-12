import OrganicCategoryTravel from "../../../../../models/opportunities/categoryTravel.model";
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

export const getCategoryTravelService = async () => {
  let data = await OrganicCategoryTravel.findOne();
  if (!data) {
    data = await OrganicCategoryTravel.create({});
  }
  return data;
};

export const updateCategoryTravelService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicCategoryTravel.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createCategoryTravelService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await OrganicCategoryTravel.create(updateData);
};

export const getAllCategoryTravelService = async () => {
  return await OrganicCategoryTravel.find();
};

export const getCategoryTravelByIdService = async (id: string) => {
  const data = await OrganicCategoryTravel.findById(id);
  if (!data) throw ApiError.notFound("Category Travel not found");
  return data;
};

export const updateCategoryTravelByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicCategoryTravel.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Category Travel not found");
  return data;
};

export const deleteCategoryTravelByIdService = async (id: string) => {
  const data = await OrganicCategoryTravel.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Category Travel not found");
  return data;
};
