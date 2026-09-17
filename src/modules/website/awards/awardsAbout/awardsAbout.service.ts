import AwardsAbout from "../../../../models/awards/awardsAbout.model";

const DEFAULT_AWARDS_ABOUT_DATA = {
  enabled: true,
  eyebrow: "ABOUT THE AWARDS",
  title: "About the Awards",
  description:
    "Bharat Organic Excellence Awards 2027 recognise outstanding organisations, brands, entrepreneurs, farmers and professionals for their remarkable contribution to the growth and promotion of the organic, natural and sustainable industry.",
  shortDescription:
    "Bharat Organic Excellence Awards 2027 recognise outstanding organisations, brands, entrepreneurs, farmers and professionals for their remarkable contribution to the growth and promotion of the organic, natural and sustainable industry.",
};

export const getAwardsAboutService = async () => {
  let data = await AwardsAbout.findOne();
  if (!data) {
    data = await AwardsAbout.create(DEFAULT_AWARDS_ABOUT_DATA);
  }
  return data;
};

export const updateAwardsAboutService = async (payload: any) => {
  let updateData = { ...payload };
  if (updateData.shortDescription && !updateData.description) {
    updateData.description = updateData.shortDescription;
  }
  if (updateData.description && !updateData.shortDescription) {
    updateData.shortDescription = updateData.description;
  }
  const data = await AwardsAbout.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
