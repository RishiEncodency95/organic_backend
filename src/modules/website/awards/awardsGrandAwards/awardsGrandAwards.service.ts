import AwardsGrandAwards from "../../../../models/awards/awardsGrandAwards.model";

const DEFAULT_GRAND_AWARDS_DATA = {
  enabled: true,
  title: "Prestigious Grand Awards",
  awards: [
    { id: 1, icon: "entrepreneur", label: "Organic Entrepreneur of the Year" },
    { id: 2, icon: "startup", label: "Organic Startup of the Year" },
    { id: 3, icon: "brand", label: "Organic Brand of the Year" },
    { id: 4, icon: "innovation", label: "Innovation of the Year" },
    { id: 5, icon: "sustainability", label: "Sustainability Leadership Award" },
    { id: 6, icon: "lifetime", label: "Lifetime Achievement Award" },
  ],
};

export const getAwardsGrandAwardsService = async () => {
  let data = await AwardsGrandAwards.findOne();
  if (!data) {
    data = await AwardsGrandAwards.create(DEFAULT_GRAND_AWARDS_DATA);
  }
  return data;
};

export const updateAwardsGrandAwardsService = async (payload: any) => {
  let updateData = { ...payload };

  if (typeof updateData.awards === "string") {
    try {
      updateData.awards = JSON.parse(updateData.awards);
    } catch {}
  }

  const data = await AwardsGrandAwards.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
