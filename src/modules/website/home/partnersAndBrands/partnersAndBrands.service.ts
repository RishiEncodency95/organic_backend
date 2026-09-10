import PartnersAndBrands from "../../../../models/home/partnersAndBrands.model";
import { ApiError } from "../../../../utils/ApiError";

const parsePayload = (payload: any, files?: any) => {
  const updateData = { ...payload };
  const arraysToParse = [
    "industryLeadersLogos",
    "knowledgeLogos",
    "wellnessLogos",
    "supportingLogos",
    "emergingBrandsLogos",
  ];

  arraysToParse.forEach((arrName) => {
    if (typeof updateData[arrName] === "string") {
      try {
        updateData[arrName] = JSON.parse(updateData[arrName]);
      } catch {
        // keep as is
      }
    }
  });

  if (files && Array.isArray(files)) {
    files.forEach((file: any) => {
      const match = file.fieldname.match(/^([a-zA-Z]+)_(\d+)$/);
      if (match) {
        const arrName = match[1];
        const index = parseInt(match[2], 10);
        if (updateData[arrName] && updateData[arrName][index]) {
          updateData[arrName][index].image = `/uploads/organic_expo/${file.filename}`;
        }
      }
    });
  }

  return updateData;
};

export const getPartnersAndBrandsService = async () => {
  let data = await PartnersAndBrands.findOne();
  if (!data) {
    data = await PartnersAndBrands.create({});
  }
  return data;
};

export const updatePartnersAndBrandsService = async (payload: any, files?: any) => {
  const updateData = parsePayload(payload, files);
  const data = await PartnersAndBrands.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};

export const createPartnersAndBrandsService = async (payload: any, files?: any) => {
  const updateData = parsePayload(payload, files);
  return await PartnersAndBrands.create(updateData);
};

export const getAllPartnersAndBrandsService = async () => {
  return await PartnersAndBrands.find();
};

export const getPartnersAndBrandsByIdService = async (id: string) => {
  const data = await PartnersAndBrands.findById(id);
  if (!data) throw ApiError.notFound("Partners and Brands not found");
  return data;
};

export const updatePartnersAndBrandsByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parsePayload(payload, files);
  const data = await PartnersAndBrands.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Partners and Brands not found");
  return data;
};

export const deletePartnersAndBrandsByIdService = async (id: string) => {
  const data = await PartnersAndBrands.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Partners and Brands not found");
  return data;
};
