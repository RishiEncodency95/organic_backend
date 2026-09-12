import BuyerSellerMeetWhyJoin from "../../../../models/buyer_seller_meet/buyerSellerMeetWhyJoin.model";
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

export const getBuyerSellerMeetWhyJoinService = async () => {
  let data = await BuyerSellerMeetWhyJoin.findOne();
  if (!data) {
    data = await BuyerSellerMeetWhyJoin.create({});
  }
  return data;
};

export const updateBuyerSellerMeetWhyJoinService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await BuyerSellerMeetWhyJoin.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createBuyerSellerMeetWhyJoinService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await BuyerSellerMeetWhyJoin.create(updateData);
};

export const getAllBuyerSellerMeetWhyJoinService = async () => {
  return await BuyerSellerMeetWhyJoin.find();
};

export const getBuyerSellerMeetWhyJoinByIdService = async (id: string) => {
  const data = await BuyerSellerMeetWhyJoin.findById(id);
  if (!data) throw ApiError.notFound("Buyer Seller Meet Why Join not found");
  return data;
};

export const updateBuyerSellerMeetWhyJoinByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await BuyerSellerMeetWhyJoin.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Buyer Seller Meet Why Join not found");
  return data;
};

export const deleteBuyerSellerMeetWhyJoinByIdService = async (id: string) => {
  const data = await BuyerSellerMeetWhyJoin.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Buyer Seller Meet Why Join not found");
  return data;
};
