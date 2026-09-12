import OrganicSponsorshipHero from "../../../../../models/opportunities/sponsorshipHero.model";
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

export const getSponsorshipHeroService = async () => {
  let data = await OrganicSponsorshipHero.findOne();
  if (!data) {
    data = await OrganicSponsorshipHero.create({});
  }
  return data;
};

export const updateSponsorshipHeroService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicSponsorshipHero.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createSponsorshipHeroService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await OrganicSponsorshipHero.create(updateData);
};

export const getAllSponsorshipHeroService = async () => {
  return await OrganicSponsorshipHero.find();
};

export const getSponsorshipHeroByIdService = async (id: string) => {
  const data = await OrganicSponsorshipHero.findById(id);
  if (!data) throw ApiError.notFound("Sponsorship Hero not found");
  return data;
};

export const updateSponsorshipHeroByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicSponsorshipHero.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Sponsorship Hero not found");
  return data;
};

export const deleteSponsorshipHeroByIdService = async (id: string) => {
  const data = await OrganicSponsorshipHero.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Sponsorship Hero not found");
  return data;
};
