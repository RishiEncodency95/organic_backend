import WhyExhibitBuyers from "../../../../../models/participate/why_exhibit/whyExhibitBuyers.model";
import { ApiError } from "../../../../../utils/ApiError";

const parseJsonFields = (payload: any, files?: any) => {
  const updateData = { ...payload };

  ["attendees", "button", "visuals"].forEach((field) => {
    if (typeof updateData[field] === "string") {
      try {
        updateData[field] = JSON.parse(updateData[field]);
      } catch {
        // keep as is
      }
    }
  });

  if (files) {
    if (!updateData.visuals) updateData.visuals = [];
    Object.keys(files).forEach((key) => {
      if (key.startsWith("visual_")) {
        const index = parseInt(key.replace("visual_", ""), 10);
        if (!isNaN(index) && updateData.visuals[index]) {
          updateData.visuals[index].img = `/uploads/organic_expo/${files[key][0].filename}`;
        }
      }
    });
  }

  return updateData;
};

export const getWhyExhibitBuyersService = async () => {
  let data = await WhyExhibitBuyers.findOne();
  if (!data) {
    data = await WhyExhibitBuyers.create({});
  }
  return data;
};

export const updateWhyExhibitBuyersService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await WhyExhibitBuyers.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createWhyExhibitBuyersService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await WhyExhibitBuyers.create(updateData);
};

export const getAllWhyExhibitBuyersService = async () => {
  return await WhyExhibitBuyers.find();
};

export const getWhyExhibitBuyersByIdService = async (id: string) => {
  const data = await WhyExhibitBuyers.findById(id);
  if (!data) throw ApiError.notFound("Why Exhibit Buyers data not found");
  return data;
};

export const updateWhyExhibitBuyersByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await WhyExhibitBuyers.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Why Exhibit Buyers data not found");
  return data;
};

export const deleteWhyExhibitBuyersByIdService = async (id: string) => {
  const data = await WhyExhibitBuyers.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Why Exhibit Buyers data not found");
  return data;
};
