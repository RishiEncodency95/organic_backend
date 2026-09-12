import IntroductionSection from "../../../../models/home/introductionSection.model";

export const getIntroductionSectionService = async () => {
  let data = await IntroductionSection.findOne();
  if (!data) {
    data = await IntroductionSection.create({});
  }
  return data;
};

export const updateIntroductionSectionService = async (payload: any, files?: any) => {
  let updateData = { ...payload };

  if (files && files.image && files.image[0]) {
    updateData.image = `/uploads/organic_expo/${files.image[0].filename}`;
  }

  // Ensure boolean for enabled and showTimer
  if (updateData.enabled !== undefined) {
    updateData.enabled = updateData.enabled === true || updateData.enabled === "true";
  }
  if (updateData.showTimer !== undefined) {
    updateData.showTimer = updateData.showTimer === true || updateData.showTimer === "true";
  }

  const data = await IntroductionSection.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });
  return data;
};
