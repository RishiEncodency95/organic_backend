import AwardsAbout from "../../../../models/awards/awardsAbout.model";

const DEFAULT_AWARDS_ABOUT_DATA = {
  enabled: true,
  title: "About the Awards",
  description:
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
  const data = await AwardsAbout.findOneAndUpdate({}, payload, {
    new: true,
    upsert: true,
  });
  return data;
};
