import AboutOrganizer from "../../../../../models/about/aboutOrganizer.model";

export const getAboutOrganizerService = async () => {
  let data = await AboutOrganizer.findOne();
  if (!data) {
    data = await AboutOrganizer.create({});
  }
  return data;
};

export const updateAboutOrganizerService = async (payload: any, files?: any) => {
  let updateData = { ...payload };

  if (typeof updateData.about === "string") {
    try {
      updateData.about = JSON.parse(updateData.about);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.badge === "string") {
    try {
      updateData.badge = JSON.parse(updateData.badge);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.journey === "string") {
    try {
      updateData.journey = JSON.parse(updateData.journey);
    } catch {
      // keep as is
    }
  }

  if (files && files.image && files.image[0]) {
    if (!updateData.about) updateData.about = {};
    updateData.about.image = `/uploads/organic_expo/${files.image[0].filename}`;
  }
  if (files && files.logoImage && files.logoImage[0]) {
    if (!updateData.about) updateData.about = {};
    updateData.about.logoImage = `/uploads/organic_expo/${files.logoImage[0].filename}`;
  }
  if (files && files.secondaryImage && files.secondaryImage[0]) {
    if (!updateData.about) updateData.about = {};
    updateData.about.secondaryImage = `/uploads/organic_expo/${files.secondaryImage[0].filename}`;
  }

  const data = await AboutOrganizer.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
