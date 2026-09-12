import OrganicEPromotionBand from "../../../../../models/opportunities/epromotionBand.model";
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

export const getEPromotionBandService = async () => {
  let data = await OrganicEPromotionBand.findOne();
  if (!data) {
    data = await OrganicEPromotionBand.create({});
  }
  return data;
};

export const updateEPromotionBandService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicEPromotionBand.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createEPromotionBandService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await OrganicEPromotionBand.create(updateData);
};

export const getAllEPromotionBandService = async () => {
  return await OrganicEPromotionBand.find();
};

export const getEPromotionBandByIdService = async (id: string) => {
  const data = await OrganicEPromotionBand.findById(id);
  if (!data) throw ApiError.notFound("E-Promotion Band not found");
  return data;
};

export const updateEPromotionBandByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicEPromotionBand.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("E-Promotion Band not found");
  return data;
};

export const deleteEPromotionBandByIdService = async (id: string) => {
  const data = await OrganicEPromotionBand.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("E-Promotion Band not found");
  return data;
};
