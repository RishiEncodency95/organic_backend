import ExhibitorItem from "../../../../../models/participate/exhibitor_list/exhibitorItem.model";
import { ApiError } from "../../../../../utils/ApiError";

const parseJsonFields = (payload: any, files?: any) => {
  const updateData = { ...payload };

  if (files && files.image && files.image[0]) {
    updateData.image = `/uploads/organic_expo/${files.image[0].filename}`;
  }

  return updateData;
};

export const getAllExhibitorItemsService = async () => {
  return await ExhibitorItem.find().sort({ order: 1, createdAt: -1 });
};

export const createExhibitorItemService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await ExhibitorItem.create(updateData);
};

export const getExhibitorItemByIdService = async (id: string) => {
  const data = await ExhibitorItem.findById(id);
  if (!data) throw ApiError.notFound("Exhibitor item not found");
  return data;
};

export const updateExhibitorItemByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await ExhibitorItem.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Exhibitor item not found");
  return data;
};

export const deleteExhibitorItemByIdService = async (id: string) => {
  const data = await ExhibitorItem.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Exhibitor item not found");
  return data;
};
