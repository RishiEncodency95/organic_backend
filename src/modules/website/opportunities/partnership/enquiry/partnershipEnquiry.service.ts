import OrganicPartnershipEnquiry from "../../../../../models/opportunities/partnershipEnquiry.model";
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

export const getPartnershipEnquiryService = async () => {
  let data = await OrganicPartnershipEnquiry.findOne();
  if (!data) {
    data = await OrganicPartnershipEnquiry.create({});
  }
  return data;
};

export const updatePartnershipEnquiryService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicPartnershipEnquiry.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createPartnershipEnquiryService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await OrganicPartnershipEnquiry.create(updateData);
};

export const getAllPartnershipEnquiryService = async () => {
  return await OrganicPartnershipEnquiry.find();
};

export const getPartnershipEnquiryByIdService = async (id: string) => {
  const data = await OrganicPartnershipEnquiry.findById(id);
  if (!data) throw ApiError.notFound("Partnership Enquiry not found");
  return data;
};

export const updatePartnershipEnquiryByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await OrganicPartnershipEnquiry.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Partnership Enquiry not found");
  return data;
};

export const deletePartnershipEnquiryByIdService = async (id: string) => {
  const data = await OrganicPartnershipEnquiry.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Partnership Enquiry not found");
  return data;
};
