import PartnersAndBrands from "../../../../models/home/partnersAndBrands.model";
import { ApiError } from "../../../../utils/ApiError";

export const DEFAULT_PARTNERS = {
  industryLeadersLogos: [
    { id: "il-1", name: "Industry Partner 1", image: "/partners/logo1.png", imageAlt: "Industry Partner 1 Logo", category: "TRUSTED BY INDUSTRY LEADERS", order: 1, status: "Published", updatedAt: "12 Sept 2026, 4:22 PM", updatedBy: "Vansh Chaudhary", fileSize: "34.9 KB" },
    { id: "il-2", name: "Industry Partner 2", image: "/partners/logo2.png", imageAlt: "Industry Partner 2 Logo", category: "TRUSTED BY INDUSTRY LEADERS", order: 2, status: "Published", updatedAt: "12 Sept 2026, 4:22 PM", updatedBy: "Vansh Chaudhary", fileSize: "97.1 KB" },
    { id: "il-3", name: "Industry Partner 3", image: "/partners/logo3.png", imageAlt: "Industry Partner 3 Logo", category: "TRUSTED BY INDUSTRY LEADERS", order: 3, status: "Published", updatedAt: "12 Sept 2026, 4:22 PM", updatedBy: "Vansh Chaudhary", fileSize: "10.0 KB" },
    { id: "il-4", name: "Industry Partner 4", image: "/partners/logo4.png", imageAlt: "Industry Partner 4 Logo", category: "TRUSTED BY INDUSTRY LEADERS", order: 4, status: "Published", updatedAt: "12 Sept 2026, 4:22 PM", updatedBy: "Vansh Chaudhary", fileSize: "66.0 KB" },
    { id: "il-5", name: "Industry Partner 5", image: "/partners/logo5.png", imageAlt: "Industry Partner 5 Logo", category: "TRUSTED BY INDUSTRY LEADERS", order: 5, status: "Published", updatedAt: "12 Sept 2026, 4:22 PM", updatedBy: "Vansh Chaudhary", fileSize: "65.1 KB" },
    { id: "il-6", name: "Industry Partner 6", image: "/partners/logo6.png", imageAlt: "Industry Partner 6 Logo", category: "TRUSTED BY INDUSTRY LEADERS", order: 6, status: "Published", updatedAt: "12 Sept 2026, 4:22 PM", updatedBy: "Vansh Chaudhary", fileSize: "5.4 KB" },
    { id: "il-7", name: "Industry Partner 7", image: "/partners/logo7.png", imageAlt: "Industry Partner 7 Logo", category: "TRUSTED BY INDUSTRY LEADERS", order: 7, status: "Published", updatedAt: "12 Sept 2026, 4:22 PM", updatedBy: "Vansh Chaudhary", fileSize: "35.9 KB" },
    { id: "il-8", name: "Industry Partner 8", image: "/partners/logo8.png", imageAlt: "Industry Partner 8 Logo", category: "TRUSTED BY INDUSTRY LEADERS", order: 8, status: "Published", updatedAt: "12 Sept 2026, 4:22 PM", updatedBy: "Vansh Chaudhary", fileSize: "45.6 KB" },
    { id: "il-9", name: "Industry Partner 9", image: "/partners/namogange.png", imageAlt: "Namo Gange Partner Logo", category: "TRUSTED BY INDUSTRY LEADERS", order: 9, status: "Published", updatedAt: "12 Sept 2026, 4:22 PM", updatedBy: "Vansh Chaudhary", fileSize: "19.4 KB" },
    { id: "il-10", name: "Industry Partner 10", image: "/partners/longlogo1.png", imageAlt: "Industry Partner 10 Logo", category: "TRUSTED BY INDUSTRY LEADERS", order: 10, status: "Published", updatedAt: "12 Sept 2026, 4:22 PM", updatedBy: "Vansh Chaudhary", fileSize: "197.9 KB" },
    { id: "il-11", name: "Industry Partner 11", image: "/partners/namo1.png", imageAlt: "Industry Partner 11 Logo", category: "TRUSTED BY INDUSTRY LEADERS", order: 11, status: "Published", updatedAt: "12 Sept 2026, 4:22 PM", updatedBy: "Vansh Chaudhary", fileSize: "153.5 KB" },
  ],
  knowledgeLogos: [
    { id: "kl-1", name: "Knowledge Partner 1", image: "/partners/logo1.png", imageAlt: "Knowledge Partner 1 Logo", category: "Knowledge Partners", order: 1, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "34.9 KB" },
    { id: "kl-2", name: "Knowledge Partner 2", image: "/partners/logo2.png", imageAlt: "Knowledge Partner 2 Logo", category: "Knowledge Partners", order: 2, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "97.1 KB" },
    { id: "kl-3", name: "Knowledge Partner 3", image: "/partners/logo3.png", imageAlt: "Knowledge Partner 3 Logo", category: "Knowledge Partners", order: 3, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "10.0 KB" },
    { id: "kl-4", name: "Knowledge Partner 4", image: "/partners/logo.png", imageAlt: "Knowledge Partner 4 Logo", category: "Knowledge Partners", order: 4, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "45.6 KB" },
    { id: "kl-5", name: "Knowledge Partner 5", image: "/partners/logo10.webp", imageAlt: "Knowledge Partner 5 Logo", category: "Knowledge Partners", order: 5, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "18.3 KB" },
  ],
  wellnessLogos: [
    { id: "wl-1", name: "Wellness Partner 1", image: "/partners/logo4.png", imageAlt: "Wellness Partner 1 Logo", category: "Wellness Partners", order: 1, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "66.0 KB" },
    { id: "wl-2", name: "Wellness Partner 2", image: "/partners/logo5.png", imageAlt: "Wellness Partner 2 Logo", category: "Wellness Partners", order: 2, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "65.1 KB" },
    { id: "wl-3", name: "Wellness Partner 3", image: "/partners/logo6.png", imageAlt: "Wellness Partner 3 Logo", category: "Wellness Partners", order: 3, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "5.4 KB" },
    { id: "wl-4", name: "Wellness Partner 4", image: "/partners/namo.png", imageAlt: "Wellness Partner 4 Logo", category: "Wellness Partners", order: 4, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "32.8 KB" },
    { id: "wl-5", name: "Wellness Partner 5", image: "/partners/logo8.png", imageAlt: "Wellness Partner 5 Logo", category: "Wellness Partners", order: 5, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "45.6 KB" },
    { id: "wl-6", name: "Wellness Partner 6", image: "/partners/footerlogo.png", imageAlt: "Wellness Partner 6 Logo", category: "Wellness Partners", order: 6, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "236.3 KB" },
  ],
  supportingLogos: [
    { id: "sl-1", name: "Supporting Assoc 1", image: "/partners/logo7.png", imageAlt: "Supporting Assoc 1 Logo", category: "Supporting Assoc.", order: 1, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "35.9 KB" },
    { id: "sl-2", name: "Supporting Assoc 2", image: "/partners/logo8.png", imageAlt: "Supporting Assoc 2 Logo", category: "Supporting Assoc.", order: 2, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "45.6 KB" },
    { id: "sl-3", name: "Supporting Assoc 3", image: "/partners/logo9.jpg", imageAlt: "Supporting Assoc 3 Logo", category: "Supporting Assoc.", order: 3, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "21.2 KB" },
    { id: "sl-4", name: "Supporting Assoc 4", image: "/partners/namogange.png", imageAlt: "Supporting Assoc 4 Logo", category: "Supporting Assoc.", order: 4, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "19.4 KB" },
    { id: "sl-5", name: "Supporting Assoc 5", image: "/partners/navbarlogo1.png", imageAlt: "Supporting Assoc 5 Logo", category: "Supporting Assoc.", order: 5, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "774.4 KB" },
  ],
  emergingBrandsLogos: [
    { id: "eb-1", name: "Emerging Brand 1", image: "/partners/logo5.png", imageAlt: "Emerging Brand 1 Logo", category: "EMERGING ORGANIC BRANDS", order: 1, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "65.1 KB" },
    { id: "eb-2", name: "Emerging Brand 2", image: "/partners/logo6.png", imageAlt: "Emerging Brand 2 Logo", category: "EMERGING ORGANIC BRANDS", order: 2, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "5.4 KB" },
    { id: "eb-3", name: "Emerging Brand 3", image: "/partners/logo7.png", imageAlt: "Emerging Brand 3 Logo", category: "EMERGING ORGANIC BRANDS", order: 3, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "35.9 KB" },
    { id: "eb-4", name: "Emerging Brand 4", image: "/partners/logo8.png", imageAlt: "Emerging Brand 4 Logo", category: "EMERGING ORGANIC BRANDS", order: 4, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "45.6 KB" },
    { id: "eb-5", name: "Emerging Brand 5", image: "/partners/logo10.webp", imageAlt: "Emerging Brand 5 Logo", category: "EMERGING ORGANIC BRANDS", order: 5, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "18.3 KB" },
    { id: "eb-6", name: "Emerging Brand 6", image: "/partners/logo.png", imageAlt: "Emerging Brand 6 Logo", category: "EMERGING ORGANIC BRANDS", order: 6, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "45.6 KB" },
    { id: "eb-7", name: "Emerging Brand 7", image: "/partners/logo1.jpg", imageAlt: "Emerging Brand 7 Logo", category: "EMERGING ORGANIC BRANDS", order: 7, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "21.2 KB" },
    { id: "eb-8", name: "Emerging Brand 8", image: "/partners/logo2.webp", imageAlt: "Emerging Brand 8 Logo", category: "EMERGING ORGANIC BRANDS", order: 8, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "18.3 KB" },
    { id: "eb-9", name: "Emerging Brand 9", image: "/partners/logo3.png", imageAlt: "Emerging Brand 9 Logo", category: "EMERGING ORGANIC BRANDS", order: 9, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "10.0 KB" },
    { id: "eb-10", name: "Emerging Brand 10", image: "/partners/logo4.png", imageAlt: "Emerging Brand 10 Logo", category: "EMERGING ORGANIC BRANDS", order: 10, status: "Published", updatedAt: "12 Sept 2026, 3:30 PM", updatedBy: "Vansh Chaudhary", fileSize: "66.0 KB" },
  ],
};

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
          updateData[arrName][index].image = `/uploads/partners/${file.filename}`;
        }
      }
    });
  }

  return updateData;
};

export const getPartnersAndBrandsService = async () => {
  let data = await PartnersAndBrands.findOne();
  if (!data) {
    data = await PartnersAndBrands.create(DEFAULT_PARTNERS);
    return data;
  }
  
  // If empty collections, seed defaults
  const totalItems =
    (data.industryLeadersLogos?.length || 0) +
    (data.knowledgeLogos?.length || 0) +
    (data.wellnessLogos?.length || 0) +
    (data.supportingLogos?.length || 0) +
    (data.emergingBrandsLogos?.length || 0);

  if (totalItems === 0) {
    data = await PartnersAndBrands.findOneAndUpdate({}, DEFAULT_PARTNERS, { new: true, upsert: true });
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
