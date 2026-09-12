import OrganicPartnershipWhy from "../../../../../models/opportunities/partnershipWhy.model";
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

export const getPartnershipWhyService = async () => {
  let data = await OrganicPartnershipWhy.findOne();
  if (!data) {
    data = await OrganicPartnershipWhy.create({});
  }
  return data;
};

export const updatePartnershipWhyService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicPartnershipWhy.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createPartnershipWhyService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await OrganicPartnershipWhy.create(updateData);
};

export const getAllPartnershipWhyService = async () => {
  return await OrganicPartnershipWhy.find();
};

export const getPartnershipWhyByIdService = async (id: string) => {
  const data = await OrganicPartnershipWhy.findById(id);
  if (!data) throw ApiError.notFound("Partnership Why not found");
  return data;
};

export const updatePartnershipWhyByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicPartnershipWhy.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Partnership Why not found");
  return data;
};

export const deletePartnershipWhyByIdService = async (id: string) => {
  const data = await OrganicPartnershipWhy.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Partnership Why not found");
  return data;
};
