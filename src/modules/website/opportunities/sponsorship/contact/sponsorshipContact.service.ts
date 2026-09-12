import OrganicSponsorshipContact from "../../../../../models/opportunities/sponsorshipContact.model";
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

export const getSponsorshipContactService = async () => {
  let data = await OrganicSponsorshipContact.findOne();
  if (!data) {
    data = await OrganicSponsorshipContact.create({});
  }
  return data;
};

export const updateSponsorshipContactService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicSponsorshipContact.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createSponsorshipContactService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await OrganicSponsorshipContact.create(updateData);
};

export const getAllSponsorshipContactService = async () => {
  return await OrganicSponsorshipContact.find();
};

export const getSponsorshipContactByIdService = async (id: string) => {
  const data = await OrganicSponsorshipContact.findById(id);
  if (!data) throw ApiError.notFound("Sponsorship Contact not found");
  return data;
};

export const updateSponsorshipContactByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicSponsorshipContact.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Sponsorship Contact not found");
  return data;
};

export const deleteSponsorshipContactByIdService = async (id: string) => {
  const data = await OrganicSponsorshipContact.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Sponsorship Contact not found");
  return data;
};
