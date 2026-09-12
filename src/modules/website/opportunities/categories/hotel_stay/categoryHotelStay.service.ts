import OrganicCategoryHotelStay from "../../../../../models/opportunities/categoryHotelStay.model";
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

export const getCategoryHotelStayService = async () => {
  let data = await OrganicCategoryHotelStay.findOne();
  if (!data) {
    data = await OrganicCategoryHotelStay.create({});
  }
  return data;
};

export const updateCategoryHotelStayService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicCategoryHotelStay.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createCategoryHotelStayService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await OrganicCategoryHotelStay.create(updateData);
};

export const getAllCategoryHotelStayService = async () => {
  return await OrganicCategoryHotelStay.find();
};

export const getCategoryHotelStayByIdService = async (id: string) => {
  const data = await OrganicCategoryHotelStay.findById(id);
  if (!data) throw ApiError.notFound("Category Hotel Stay not found");
  return data;
};

export const updateCategoryHotelStayByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicCategoryHotelStay.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Category Hotel Stay not found");
  return data;
};

export const deleteCategoryHotelStayByIdService = async (id: string) => {
  const data = await OrganicCategoryHotelStay.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Category Hotel Stay not found");
  return data;
};
