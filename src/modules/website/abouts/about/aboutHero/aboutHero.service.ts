import AboutHero from "../../../../../models/about/aboutHero.model";

export const getAboutHeroService = async () => {
  let data = await AboutHero.findOne();
  if (!data) {
    data = await AboutHero.create({});
  }
  return data;
};

export const updateAboutHeroService = async (payload: any, files?: any) => {
  let updateData = { ...payload };

  if (typeof updateData.buttons === "string") {
    try {
      updateData.buttons = JSON.parse(updateData.buttons);
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

  const data = await AboutHero.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
