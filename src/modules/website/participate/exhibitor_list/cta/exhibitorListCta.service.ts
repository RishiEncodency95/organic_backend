import ExhibitorListCta from "../../../../../models/participate/exhibitor_list/exhibitorListCta.model";
import { ApiError } from "../../../../../utils/ApiError";

const parseJsonFields = (payload: any, files?: any) => {
  const updateData = { ...payload };

  ["buttons", "bottomStats"].forEach((field) => {
    if (typeof updateData[field] === "string") {
      try {
        updateData[field] = JSON.parse(updateData[field]);
      } catch {
        // keep as is
      }
    }
  });

  if (files && files.beImg && files.beImg[0]) {
    updateData.beImg = `/uploads/organic_expo/${files.beImg[0].filename}`;
  }

  if (files && files.leafImg && files.leafImg[0]) {
    updateData.leafImg = `/uploads/organic_expo/${files.leafImg[0].filename}`;
  }

  return updateData;
};

export const getExhibitorListCtaService = async () => {
  let data = await ExhibitorListCta.findOne();
  if (!data) {
    data = await ExhibitorListCta.create({});
  }
  return data;
};

export const updateExhibitorListCtaService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await ExhibitorListCta.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  return data;
};

export const createExhibitorListCtaService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await ExhibitorListCta.create(updateData);
};

export const getAllExhibitorListCtaService = async () => {
  return await ExhibitorListCta.find();
};

export const getExhibitorListCtaByIdService = async (id: string) => {
  const data = await ExhibitorListCta.findById(id);
  if (!data) throw ApiError.notFound("Exhibitor List CTA not found");
  return data;
};

export const updateExhibitorListCtaByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await ExhibitorListCta.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Exhibitor List CTA not found");
  return data;
};

export const deleteExhibitorListCtaByIdService = async (id: string) => {
  const data = await ExhibitorListCta.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Exhibitor List CTA not found");
  return data;
};
