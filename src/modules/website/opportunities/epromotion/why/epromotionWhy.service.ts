import OrganicEPromotionWhy from "../../../../../models/opportunities/epromotionWhy.model";
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

export const getEPromotionWhyService = async () => {
  let data = await OrganicEPromotionWhy.findOne();
  if (!data) {
    data = await OrganicEPromotionWhy.create({});
  }
  return data;
};

export const updateEPromotionWhyService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicEPromotionWhy.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createEPromotionWhyService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await OrganicEPromotionWhy.create(updateData);
};

export const getAllEPromotionWhyService = async () => {
  return await OrganicEPromotionWhy.find();
};

export const getEPromotionWhyByIdService = async (id: string) => {
  const data = await OrganicEPromotionWhy.findById(id);
  if (!data) throw ApiError.notFound("E-Promotion Why not found");
  return data;
};

export const updateEPromotionWhyByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicEPromotionWhy.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("E-Promotion Why not found");
  return data;
};

export const deleteEPromotionWhyByIdService = async (id: string) => {
  const data = await OrganicEPromotionWhy.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("E-Promotion Why not found");
  return data;
};
