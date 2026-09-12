import BuyerSellerMeetWhatToSource from "../../../../models/buyer_seller_meet/buyerSellerMeetWhatToSource.model";
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

export const getBuyerSellerMeetWhatToSourceService = async () => {
  let data = await BuyerSellerMeetWhatToSource.findOne();
  if (!data) {
    data = await BuyerSellerMeetWhatToSource.create({});
  }
  return data;
};

export const updateBuyerSellerMeetWhatToSourceService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await BuyerSellerMeetWhatToSource.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createBuyerSellerMeetWhatToSourceService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await BuyerSellerMeetWhatToSource.create(updateData);
};

export const getAllBuyerSellerMeetWhatToSourceService = async () => {
  return await BuyerSellerMeetWhatToSource.find();
};

export const getBuyerSellerMeetWhatToSourceByIdService = async (id: string) => {
  const data = await BuyerSellerMeetWhatToSource.findById(id);
  if (!data) throw ApiError.notFound("Buyer Seller Meet What To Source not found");
  return data;
};

export const updateBuyerSellerMeetWhatToSourceByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await BuyerSellerMeetWhatToSource.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Buyer Seller Meet What To Source not found");
  return data;
};

export const deleteBuyerSellerMeetWhatToSourceByIdService = async (id: string) => {
  const data = await BuyerSellerMeetWhatToSource.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Buyer Seller Meet What To Source not found");
  return data;
};
