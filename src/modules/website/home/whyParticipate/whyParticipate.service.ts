import WhyParticipate from "../../../../models/home/whyParticipate.model";
import { ApiError } from "../../../../utils/ApiError";

const parseJsonFields = (payload: any, files?: any) => {
  const updateData = { ...payload };

  if (typeof updateData.points === "string") {
    try {
      updateData.points = JSON.parse(updateData.points);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.mainPoints === "string") {
    try {
      updateData.mainPoints = JSON.parse(updateData.mainPoints);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.buttons === "string") {
    try {
      updateData.buttons = JSON.parse(updateData.buttons);
    } catch {
      // keep as is
    }
  }

  if (files && files.image && files.image[0]) {
    updateData.image = `/uploads/organic_expo/${files.image[0].filename}`;
  }

  if (files && files.brochure && files.brochure[0]) {
    if (!updateData.buttons) updateData.buttons = {};
    if (!updateData.buttons.brochure) updateData.buttons.brochure = {};
    updateData.buttons.brochure.link = `/uploads/organic_expo/${files.brochure[0].filename}`;
  }

  return updateData;
};

export const getWhyParticipateService = async () => {
  let data = await WhyParticipate.findOne();
  if (!data) {
    data = await WhyParticipate.create({});
  }
  return data;
};

export const updateWhyParticipateService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await WhyParticipate.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};

export const createWhyParticipateService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await WhyParticipate.create(updateData);
};

export const getAllWhyParticipateService = async () => {
  return await WhyParticipate.find();
};

export const getWhyParticipateByIdService = async (id: string) => {
  const data = await WhyParticipate.findById(id);
  if (!data) throw ApiError.notFound("Why Participate not found");
  return data;
};

export const updateWhyParticipateByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await WhyParticipate.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Why Participate not found");
  return data;
};

export const deleteWhyParticipateByIdService = async (id: string) => {
  const data = await WhyParticipate.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Why Participate not found");
  return data;
};
