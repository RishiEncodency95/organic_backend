import SponsorshipCategories from "../../../../models/home/sponsorshipCategories.model";

export const getSponsorshipCategoriesService = async () => {
  let data = await SponsorshipCategories.findOne();
  if (!data) {
    data = await SponsorshipCategories.create({});
  }
  return data;
};

export const updateSponsorshipCategoriesService = async (payload: any, files?: any) => {
  let updateData = { ...payload };

  if (typeof updateData.categories === "string") {
    try {
      updateData.categories = JSON.parse(updateData.categories);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.promoBox === "string") {
    try {
      updateData.promoBox = JSON.parse(updateData.promoBox);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.form === "string") {
    try {
      updateData.form = JSON.parse(updateData.form);
    } catch {
      // keep as is
    }
  }

  if (files && files.image && files.image[0]) {
    if (!updateData.promoBox) updateData.promoBox = {};
    updateData.promoBox.image = `/uploads/organic_expo/${files.image[0].filename}`;
  }

  const data = await SponsorshipCategories.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
