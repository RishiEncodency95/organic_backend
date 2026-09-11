import ExhibitorListHeader from "../../../../../models/participate/exhibitor_list/exhibitorListHeader.model";
import { ApiError } from "../../../../../utils/ApiError";

export const getExhibitorListHeaderService = async () => {
  let data = await ExhibitorListHeader.findOne();
  if (!data) {
    data = await ExhibitorListHeader.create({});
  }
  return data;
};

export const updateExhibitorListHeaderService = async (payload: any) => {
  const data = await ExhibitorListHeader.findOneAndUpdate({}, payload, { new: true, upsert: true });
  return data;
};

export const createExhibitorListHeaderService = async (payload: any) => {
  return await ExhibitorListHeader.create(payload);
};

export const getAllExhibitorListHeaderService = async () => {
  return await ExhibitorListHeader.find();
};

export const getExhibitorListHeaderByIdService = async (id: string) => {
  const data = await ExhibitorListHeader.findById(id);
  if (!data) throw ApiError.notFound("Exhibitor List Header not found");
  return data;
};

export const updateExhibitorListHeaderByIdService = async (id: string, payload: any) => {
  const data = await ExhibitorListHeader.findByIdAndUpdate(id, payload, { new: true });
  if (!data) throw ApiError.notFound("Exhibitor List Header not found");
  return data;
};

export const deleteExhibitorListHeaderByIdService = async (id: string) => {
  const data = await ExhibitorListHeader.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Exhibitor List Header not found");
  return data;
};
