import ExhibitionCategoriesHero from "../../../../models/exhibition_categories/exhibitionCategoriesHero.model";

export const getExhibitionCategoriesHeroService = async () => {
  let data = await ExhibitionCategoriesHero.findOne();
  if (!data) {
    data = await ExhibitionCategoriesHero.create({});
  }
  return data;
};

export const updateExhibitionCategoriesHeroService = async (payload: any) => {
  const updateData = { ...payload };

  if (typeof updateData.features === "string") {
    try {
      updateData.features = JSON.parse(updateData.features);
    } catch {
      // keep as is
    }
  }
  if (Array.isArray(updateData.features)) {
    updateData.features = updateData.features.map((f: any) => ({
      value: String(f?.value ?? "").trim(),
      label: String(f?.label ?? "").trim(),
    }));
  }

  return ExhibitionCategoriesHero.findOneAndUpdate({}, updateData, { new: true, upsert: true });
};
