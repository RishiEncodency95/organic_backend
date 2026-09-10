import AboutVenue from "../../../../../models/about/aboutVenue.model";

export const getAboutVenueService = async () => {
  let data = await AboutVenue.findOne();
  if (!data) {
    data = await AboutVenue.create({});
  }
  return data;
};

export const updateAboutVenueService = async (payload: any, files?: any) => {
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

  const data = await AboutVenue.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
