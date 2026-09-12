import BuyerSellerMeetConnectWith from "../../../../models/buyer_seller_meet/buyerSellerMeetConnectWith.model";
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

export const getBuyerSellerMeetConnectWithService = async () => {
  let data = await BuyerSellerMeetConnectWith.findOne();
  if (!data) {
    data = await BuyerSellerMeetConnectWith.create({});
  }
  return data;
};

export const updateBuyerSellerMeetConnectWithService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await BuyerSellerMeetConnectWith.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createBuyerSellerMeetConnectWithService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await BuyerSellerMeetConnectWith.create(updateData);
};

export const getAllBuyerSellerMeetConnectWithService = async () => {
  return await BuyerSellerMeetConnectWith.find();
};

export const getBuyerSellerMeetConnectWithByIdService = async (id: string) => {
  const data = await BuyerSellerMeetConnectWith.findById(id);
  if (!data) throw ApiError.notFound("Buyer Seller Meet Connect With not found");
  return data;
};

export const updateBuyerSellerMeetConnectWithByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await BuyerSellerMeetConnectWith.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Buyer Seller Meet Connect With not found");
  return data;
};

export const deleteBuyerSellerMeetConnectWithByIdService = async (id: string) => {
  const data = await BuyerSellerMeetConnectWith.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Buyer Seller Meet Connect With not found");
  return data;
};
