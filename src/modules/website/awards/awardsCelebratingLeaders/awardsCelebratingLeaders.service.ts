import AwardsCelebratingLeaders from "../../../../models/awards/awardsCelebratingLeaders.model";

const DEFAULT_CELEBRATING_LEADERS_DATA = {
  enabled: true,
  badge: "Bharat Organic Excellence Awards 2027",
  titlePrimary: "Celebrating India's",
  titleSecondary: "Organic Leaders",
  description:
    "From farm to shelf, we honour the changemakers who are building a cleaner, healthier and more sustainable India.",
  leaderTypes: [
    { id: 1, icon: "Sprout", label: "Farmers & Producer Groups" },
    { id: 2, icon: "Store", label: "Brands & Companies" },
    { id: 3, icon: "Lightbulb", label: "Startups & Innovators" },
    { id: 4, icon: "Globe2", label: "Exporters & Traders" },
  ],
};

export const getAwardsCelebratingLeadersService = async () => {
  let data = await AwardsCelebratingLeaders.findOne();
  if (!data) {
    data = await AwardsCelebratingLeaders.create(
      DEFAULT_CELEBRATING_LEADERS_DATA
    );
  }
  return data;
};

export const updateAwardsCelebratingLeadersService = async (payload: any) => {
  let updateData = { ...payload };

  if (typeof updateData.leaderTypes === "string") {
    try {
      updateData.leaderTypes = JSON.parse(updateData.leaderTypes);
    } catch {}
  }

  const data = await AwardsCelebratingLeaders.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
