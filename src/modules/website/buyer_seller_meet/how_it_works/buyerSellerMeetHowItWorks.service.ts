import BuyerSellerMeetHowItWorks from "../../../../models/buyer_seller_meet/buyerSellerMeetHowItWorks.model";
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

export const getBuyerSellerMeetHowItWorksService = async () => {
  let data = await BuyerSellerMeetHowItWorks.findOne();
  if (!data) {
    data = await BuyerSellerMeetHowItWorks.create({});
  }
  return data;
};

export const updateBuyerSellerMeetHowItWorksService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await BuyerSellerMeetHowItWorks.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createBuyerSellerMeetHowItWorksService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await BuyerSellerMeetHowItWorks.create(updateData);
};

export const getAllBuyerSellerMeetHowItWorksService = async () => {
  return await BuyerSellerMeetHowItWorks.find();
};

export const getBuyerSellerMeetHowItWorksByIdService = async (id: string) => {
  const data = await BuyerSellerMeetHowItWorks.findById(id);
  if (!data) throw ApiError.notFound("Buyer Seller Meet How It Works not found");
  return data;
};

export const updateBuyerSellerMeetHowItWorksByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await BuyerSellerMeetHowItWorks.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Buyer Seller Meet How It Works not found");
  return data;
};

export const deleteBuyerSellerMeetHowItWorksByIdService = async (id: string) => {
  const data = await BuyerSellerMeetHowItWorks.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Buyer Seller Meet How It Works not found");
  return data;
};
