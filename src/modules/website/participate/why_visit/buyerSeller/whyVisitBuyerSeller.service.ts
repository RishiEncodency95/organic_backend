import WhyVisitBuyerSeller from "../../../../../models/participate/why_visit/whyVisitBuyerSeller.model";
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

export const getWhyVisitBuyerSellerService = async () => {
  let data = await WhyVisitBuyerSeller.findOne();
  if (!data) {
    data = await WhyVisitBuyerSeller.create({});
  }
  return data;
};

export const updateWhyVisitBuyerSellerService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await WhyVisitBuyerSeller.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createWhyVisitBuyerSellerService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await WhyVisitBuyerSeller.create(updateData);
};

export const getAllWhyVisitBuyerSellerService = async () => {
  return await WhyVisitBuyerSeller.find();
};

export const getWhyVisitBuyerSellerByIdService = async (id: string) => {
  const data = await WhyVisitBuyerSeller.findById(id);
  if (!data) throw ApiError.notFound("Why Visit Buyer Seller not found");
  return data;
};

export const updateWhyVisitBuyerSellerByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await WhyVisitBuyerSeller.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Why Visit Buyer Seller not found");
  return data;
};

export const deleteWhyVisitBuyerSellerByIdService = async (id: string) => {
  const data = await WhyVisitBuyerSeller.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Why Visit Buyer Seller not found");
  return data;
};
