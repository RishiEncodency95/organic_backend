import BuyerSellerMeetFeatureStrip from "../../../../models/buyer_seller_meet/buyerSellerMeetFeatureStrip.model";
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

export const getBuyerSellerMeetFeatureStripService = async () => {
  let data = await BuyerSellerMeetFeatureStrip.findOne();
  if (!data) {
    data = await BuyerSellerMeetFeatureStrip.create({});
  }
  return data;
};

export const updateBuyerSellerMeetFeatureStripService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await BuyerSellerMeetFeatureStrip.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createBuyerSellerMeetFeatureStripService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await BuyerSellerMeetFeatureStrip.create(updateData);
};

export const getAllBuyerSellerMeetFeatureStripService = async () => {
  return await BuyerSellerMeetFeatureStrip.find();
};

export const getBuyerSellerMeetFeatureStripByIdService = async (id: string) => {
  const data = await BuyerSellerMeetFeatureStrip.findById(id);
  if (!data) throw ApiError.notFound("Buyer Seller Meet Feature Strip not found");
  return data;
};

export const updateBuyerSellerMeetFeatureStripByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await BuyerSellerMeetFeatureStrip.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Buyer Seller Meet Feature Strip not found");
  return data;
};

export const deleteBuyerSellerMeetFeatureStripByIdService = async (id: string) => {
  const data = await BuyerSellerMeetFeatureStrip.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Buyer Seller Meet Feature Strip not found");
  return data;
};
