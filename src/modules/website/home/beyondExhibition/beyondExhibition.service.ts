import BeyondExhibition from "../../../../models/home/beyondExhibition.model";

export const getBeyondExhibitionService = async () => {
  let data = await BeyondExhibition.findOne();
  if (!data) {
    data = await BeyondExhibition.create({});
  }
  return data;
};

export const updateBeyondExhibitionService = async (payload: any, files?: any) => {
  let updateData = { ...payload };

  if (typeof updateData.extras === "string") {
    try {
      updateData.extras = JSON.parse(updateData.extras);
    } catch {
      // keep as is
    }
  }

  if (files && files.image && files.image[0]) {
    updateData.image = `/uploads/organic_expo/${files.image[0].filename}`;
  }

  const data = await BeyondExhibition.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
