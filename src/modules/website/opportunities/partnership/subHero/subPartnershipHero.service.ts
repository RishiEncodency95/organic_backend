import SubPartnershipHero from "../../../../../models/opportunities/subPartnershipHero.model";
import { ApiError } from "../../../../../utils/ApiError";

const CDN = "https://res.cloudinary.com/ldlcnnhz/image/upload";

// Defaults mirror the text each page showed before this was editable.
export const SUB_PARTNERSHIP_DEFAULTS: Record<string, Record<string, string>> = {
  "hotel-stay-partner": {
    title: "HOTEL & STAY PARTNER",
    subtitle: "Stay Smart. Partner Stronger.",
    description:
      "Partner with Bharat Organic Expo 2027 as our Hotel & Stay Partner and offer premium accommodation solutions to delegates, exhibitors and visitors from across India and the world.",
    image: `${CDN}/v1791017782/bharat-organic/partnership/hotel-stay-partner-bg.webp`,
    imageAlt: "Hotel Stay Partner BG",
  },
  "travel-partner": {
    title: "TRAVEL PARTNER",
    subtitle: "Travel Seamless. Partner Stronger.",
    description:
      "Partner with Bharat Organic Expo 2027 as our Travel Partner and provide end-to-end travel, flight booking, shuttle & local transport solutions for delegates, exhibitors and visitors attending from India and abroad.",
    image: `${CDN}/v1791017783/bharat-organic/partnership/travel-partner-bg.webp`,
    imageAlt: "Travel Partner BG",
  },
  "stall-design-partner": {
    title: "STALL DESIGN & FABRICATION PARTNER",
    subtitle: "Design Smart. Build Stronger.",
    description:
      "Partner with Bharat Organic Expo 2027 as our Stall Design & Fabrication Partner and deliver creative, customized booth designs and quality construction for leading brands and exhibitors at the expo.",
    image: `${CDN}/v1791017784/bharat-organic/partnership/stall-design-partner-bg.webp`,
    imageAlt: "Stall Design Partner BG",
  },
  "logistics-partner": {
    title: "LOGISTICS PARTNER",
    subtitle: "Move Smart. Deliver Excellence.",
    description:
      "Partner with Bharat Organic Expo 2027 as our Logistics Partner and provide seamless supply chain, transport & handling solutions for exhibitors and organizers from across India and abroad.",
    image: `${CDN}/v1791017785/bharat-organic/partnership/logistics-partner-bg.webp`,
    imageAlt: "Logistics Partner BG",
  },
  "printing-branding-partner": {
    title: "PRINTING & BRANDING PARTNER",
    subtitle: "Print Perfection. Brand Prominence.",
    description:
      "Partner with Bharat Organic Expo 2027 as our Printing & Branding Partner and supply high-quality signage, banners, print collaterals & branding services for exhibitors and organizers during the flagship expo.",
    image: `${CDN}/v1791017786/bharat-organic/partnership/printing-branding-partner-bg.webp`,
    imageAlt: "Printing & Branding Partner BG",
  },
  "manpower-supply-partner": {
    title: "MANPOWER SUPPLY PARTNER",
    subtitle: "Empower Events. Provide Excellence.",
    description:
      "Partner with Bharat Organic Expo 2027 as our Manpower Supply Partner and supply trained hostesses, promoters, security & operational staff for exhibitors and organizers during the premier event.",
    image: `${CDN}/v1791017787/bharat-organic/partnership/manpower-supply-partner-bg.webp`,
    imageAlt: "Manpower Supply Partner BG",
  },
};

const assertKnownSlug = (slug: string) => {
  if (!SUB_PARTNERSHIP_DEFAULTS[slug]) throw ApiError.notFound("Unknown partnership page");
};

export const getSubPartnershipHeroService = async (slug: string) => {
  assertKnownSlug(slug);
  let data = await SubPartnershipHero.findOne({ slug });
  if (!data) {
    data = await SubPartnershipHero.create({ slug, ...SUB_PARTNERSHIP_DEFAULTS[slug] });
  }
  return data;
};

const EDITABLE = ["title", "subtitle", "description", "date", "location", "image", "imageAlt"] as const;

export const updateSubPartnershipHeroService = async (slug: string, payload: any) => {
  assertKnownSlug(slug);
  const update: Record<string, string> = {};
  for (const key of EDITABLE) {
    if (typeof payload?.[key] === "string") update[key] = payload[key];
  }
  return SubPartnershipHero.findOneAndUpdate(
    { slug },
    { $set: update, $setOnInsert: { slug } },
    { new: true, upsert: true }
  );
};
