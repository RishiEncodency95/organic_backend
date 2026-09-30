import TermsHero from "../../../../../models/registration/termsHero.model";

const ALLOWED_FIELDS = [
  "enabled",
  "eyebrow",
  "title",
  "subtitle",
  "description",
  "buttonLabel",
  "image",
  "imageAlt",
] as const;

export const getTermsHeroService = async () => {
  let data = await TermsHero.findOne();
  if (!data) {
    data = await TermsHero.create({});
  }
  return data;
};

export const updateTermsHeroService = async (payload: any) => {
  const updateData: Record<string, any> = {};
  for (const field of ALLOWED_FIELDS) {
    if (payload?.[field] !== undefined) updateData[field] = payload[field];
  }
  if (typeof updateData.enabled === "string") {
    updateData.enabled = updateData.enabled !== "false";
  }

  const data = await TermsHero.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
