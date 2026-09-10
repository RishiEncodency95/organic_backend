import AdvisoryHero from "../../../../../models/advisory_board_member/advisoryHero.model";

export const getAdvisoryHeroService = async () => {
  let data = await AdvisoryHero.findOne();
  if (!data) {
    data = await AdvisoryHero.create({});
  }
  return data;
};

export const updateAdvisoryHeroService = async (payload: any, files?: any) => {
  let updateData = { ...payload };

  if (typeof updateData.features === "string") {
    try {
      updateData.features = JSON.parse(updateData.features);
    } catch {
      // keep as is
    }
  }

  if (files && files.image && files.image[0]) {
    updateData.image = `/uploads/organic_expo/${files.image[0].filename}`;
  }
  if (files && files.secondaryImage && files.secondaryImage[0]) {
    updateData.secondaryImage = `/uploads/organic_expo/${files.secondaryImage[0].filename}`;
  }

  const data = await AdvisoryHero.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
