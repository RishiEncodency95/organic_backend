import BuyerSellerMeetAbout from "../../../../models/buyer_seller_meet/buyerSellerMeetAbout.model";
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

export const getBuyerSellerMeetAboutService = async () => {
  let data = await BuyerSellerMeetAbout.findOne();
  if (!data) {
    data = await BuyerSellerMeetAbout.create({});
  }
  return data;
};

export const updateBuyerSellerMeetAboutService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await BuyerSellerMeetAbout.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createBuyerSellerMeetAboutService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await BuyerSellerMeetAbout.create(updateData);
};

export const getAllBuyerSellerMeetAboutService = async () => {
  return await BuyerSellerMeetAbout.find();
};

export const getBuyerSellerMeetAboutByIdService = async (id: string) => {
  const data = await BuyerSellerMeetAbout.findById(id);
  if (!data) throw ApiError.notFound("Buyer Seller Meet About not found");
  return data;
};

export const updateBuyerSellerMeetAboutByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await BuyerSellerMeetAbout.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Buyer Seller Meet About not found");
  return data;
};

export const deleteBuyerSellerMeetAboutByIdService = async (id: string) => {
  const data = await BuyerSellerMeetAbout.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Buyer Seller Meet About not found");
  return data;
};
