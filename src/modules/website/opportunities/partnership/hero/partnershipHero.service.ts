import OrganicPartnershipHero from "../../../../../models/opportunities/partnershipHero.model";
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

export const getPartnershipHeroService = async () => {
  let data = await OrganicPartnershipHero.findOne();
  if (!data) {
    data = await OrganicPartnershipHero.create({});
  }
  return data;
};

export const updatePartnershipHeroService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicPartnershipHero.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createPartnershipHeroService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await OrganicPartnershipHero.create(updateData);
};

export const getAllPartnershipHeroService = async () => {
  return await OrganicPartnershipHero.find();
};

export const getPartnershipHeroByIdService = async (id: string) => {
  const data = await OrganicPartnershipHero.findById(id);
  if (!data) throw ApiError.notFound("Partnership Hero not found");
  return data;
};

export const updatePartnershipHeroByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicPartnershipHero.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Partnership Hero not found");
  return data;
};

export const deletePartnershipHeroByIdService = async (id: string) => {
  const data = await OrganicPartnershipHero.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Partnership Hero not found");
  return data;
};
