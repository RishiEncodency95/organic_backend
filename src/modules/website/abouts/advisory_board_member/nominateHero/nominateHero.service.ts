import NominateAdvisoryHero from "../../../../../models/about/nominateAdvisoryHero.model";

export const getNominateHeroService = async () => {
  let data = await NominateAdvisoryHero.findOne();
  if (!data) {
    data = await NominateAdvisoryHero.create({});
  }
  return data;
};

export const updateNominateHeroService = async (payload: any) => {
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
      label: String(f?.label ?? "").trim(),
      icon: String(f?.icon ?? "").trim(),
    }));
  }

  return NominateAdvisoryHero.findOneAndUpdate({}, updateData, { new: true, upsert: true });
};
