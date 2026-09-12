import BuyerSellerMeetHero from "../../../../models/buyer_seller_meet/buyerSellerMeetHero.model";
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

export const getBuyerSellerMeetHeroService = async () => {
  let data = await BuyerSellerMeetHero.findOne();
  if (!data) {
    data = await BuyerSellerMeetHero.create({});
  }
  return data;
};

export const updateBuyerSellerMeetHeroService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await BuyerSellerMeetHero.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createBuyerSellerMeetHeroService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await BuyerSellerMeetHero.create(updateData);
};

export const getAllBuyerSellerMeetHeroService = async () => {
  return await BuyerSellerMeetHero.find();
};

export const getBuyerSellerMeetHeroByIdService = async (id: string) => {
  const data = await BuyerSellerMeetHero.findById(id);
  if (!data) throw ApiError.notFound("Buyer Seller Meet Hero not found");
  return data;
};

export const updateBuyerSellerMeetHeroByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await BuyerSellerMeetHero.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Buyer Seller Meet Hero not found");
  return data;
};

export const deleteBuyerSellerMeetHeroByIdService = async (id: string) => {
  const data = await BuyerSellerMeetHero.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Buyer Seller Meet Hero not found");
  return data;
};
