import OrganicSponsorshipPackages from "../../../../../models/opportunities/sponsorshipPackages.model";
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

export const getSponsorshipPackagesService = async () => {
  let data = await OrganicSponsorshipPackages.findOne();
  if (!data) {
    data = await OrganicSponsorshipPackages.create({});
  }
  return data;
};

export const updateSponsorshipPackagesService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicSponsorshipPackages.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createSponsorshipPackagesService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await OrganicSponsorshipPackages.create(updateData);
};

export const getAllSponsorshipPackagesService = async () => {
  return await OrganicSponsorshipPackages.find();
};

export const getSponsorshipPackagesByIdService = async (id: string) => {
  const data = await OrganicSponsorshipPackages.findById(id);
  if (!data) throw ApiError.notFound("Sponsorship Packages not found");
  return data;
};

export const updateSponsorshipPackagesByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicSponsorshipPackages.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Sponsorship Packages not found");
  return data;
};

export const deleteSponsorshipPackagesByIdService = async (id: string) => {
  const data = await OrganicSponsorshipPackages.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Sponsorship Packages not found");
  return data;
};
