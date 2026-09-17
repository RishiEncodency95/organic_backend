import AwardsStats from "../../../../models/awards/awardsStats.model";

const DEFAULT_AWARDS_STATS_DATA = {
  enabled: true,
  eyebrow: "AWARDS STATS",
  title: "Key Metrics & Scale",
  items: [
    { id: 1, icon: "Trophy", title: "200+", subtitle: "CATEGORIES", label: "CATEGORIES" },
    { id: 2, icon: "Award", title: "30+", subtitle: "GRAND AWARDS", label: "GRAND AWARDS" },
    { id: 3, icon: "Users", title: "EXPERT", subtitle: "JURY PANEL", label: "JURY PANEL" },
    { id: 4, icon: "Globe2", title: "NATIONWIDE &", subtitle: "GLOBAL RECOGNITION", label: "GLOBAL RECOGNITION" },
    { id: 5, icon: "Medal", title: "CREDIBILITY", subtitle: "& TRANSPARENCY", label: "& TRANSPARENCY" },
  ],
};

export const getAwardsStatsService = async () => {
  let data = await AwardsStats.findOne();
  if (!data) {
    data = await AwardsStats.create(DEFAULT_AWARDS_STATS_DATA);
  }
  return data;
};

export const updateAwardsStatsService = async (payload: any) => {
  let updateData = { ...payload };

  if (typeof updateData.items === "string") {
    try {
      updateData.items = JSON.parse(updateData.items);
    } catch {}
  }

  if (Array.isArray(updateData.items)) {
    updateData.items = updateData.items.map((it: any, idx: number) => ({
      id: it.id || idx + 1,
      icon: it.icon || "Trophy",
      title: it.title || "",
      subtitle: it.subtitle || it.label || "",
      label: it.label || it.subtitle || "",
    }));
  }

  const data = await AwardsStats.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
