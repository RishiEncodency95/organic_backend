import HomeAbout from "../../../../../models/about/homeAbout.model";

export const getHomeAboutService = async () => {
  let data = await HomeAbout.findOne();
  if (!data) {
    data = await HomeAbout.create({});
  }
  return data;
};

export const updateHomeAboutService = async (payload: any, files?: any) => {
  let updateData = { ...payload };

  if (typeof updateData.paragraphs === "string") {
    try {
      updateData.paragraphs = JSON.parse(updateData.paragraphs);
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

  const data = await HomeAbout.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
