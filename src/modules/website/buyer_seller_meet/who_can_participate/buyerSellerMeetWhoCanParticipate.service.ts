import BuyerSellerMeetWhoCanParticipate from "../../../../models/buyer_seller_meet/buyerSellerMeetWhoCanParticipate.model";
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

export const getBuyerSellerMeetWhoCanParticipateService = async () => {
  let data = await BuyerSellerMeetWhoCanParticipate.findOne();
  if (!data) {
    data = await BuyerSellerMeetWhoCanParticipate.create({});
  }
  return data;
};

export const updateBuyerSellerMeetWhoCanParticipateService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await BuyerSellerMeetWhoCanParticipate.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createBuyerSellerMeetWhoCanParticipateService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await BuyerSellerMeetWhoCanParticipate.create(updateData);
};

export const getAllBuyerSellerMeetWhoCanParticipateService = async () => {
  return await BuyerSellerMeetWhoCanParticipate.find();
};

export const getBuyerSellerMeetWhoCanParticipateByIdService = async (id: string) => {
  const data = await BuyerSellerMeetWhoCanParticipate.findById(id);
  if (!data) throw ApiError.notFound("Buyer Seller Meet Who Can Participate not found");
  return data;
};

export const updateBuyerSellerMeetWhoCanParticipateByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await BuyerSellerMeetWhoCanParticipate.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Buyer Seller Meet Who Can Participate not found");
  return data;
};

export const deleteBuyerSellerMeetWhoCanParticipateByIdService = async (id: string) => {
  const data = await BuyerSellerMeetWhoCanParticipate.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Buyer Seller Meet Who Can Participate not found");
  return data;
};
