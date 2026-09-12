import BuyerSellerMeetCta from "../../../../models/buyer_seller_meet/buyerSellerMeetCta.model";
import { ApiError } from "../../../../utils/ApiError";

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

export const getBuyerSellerMeetCtaService = async () => {
  let data = await BuyerSellerMeetCta.findOne();
  if (!data) {
    data = await BuyerSellerMeetCta.create({});
  }
  return data;
};

export const updateBuyerSellerMeetCtaService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await BuyerSellerMeetCta.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createBuyerSellerMeetCtaService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await BuyerSellerMeetCta.create(updateData);
};

export const getAllBuyerSellerMeetCtaService = async () => {
  return await BuyerSellerMeetCta.find();
};

export const getBuyerSellerMeetCtaByIdService = async (id: string) => {
  const data = await BuyerSellerMeetCta.findById(id);
  if (!data) throw ApiError.notFound("Buyer Seller Meet CTA not found");
  return data;
};

export const updateBuyerSellerMeetCtaByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await BuyerSellerMeetCta.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Buyer Seller Meet CTA not found");
  return data;
};

export const deleteBuyerSellerMeetCtaByIdService = async (id: string) => {
  const data = await BuyerSellerMeetCta.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Buyer Seller Meet CTA not found");
  return data;
};
