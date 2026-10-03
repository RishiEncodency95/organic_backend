import ExhibitorsHero from "../../../../models/exhibitorsHero.model";

export const getExhibitorsHeroService = async () => {
  let data = await ExhibitorsHero.findOne();
  if (!data) {
    data = await ExhibitorsHero.create({});
  }
  return data;
};

export const updateExhibitorsHeroService = async (payload: any) => {
  return ExhibitorsHero.findOneAndUpdate({}, { ...payload }, { new: true, upsert: true });
};
