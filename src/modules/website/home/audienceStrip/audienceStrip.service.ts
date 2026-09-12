import AudienceStrip from "../../../../models/home/audienceStrip.model";

const DEFAULT_ITEMS = [
  {
    title: "UNIVERSITY",
    subtitle: "ACADEMIC PARTNERS",
    label: "UNIVERSITY ACADEMIC PARTNERS",
    icon: "GraduationCap",
    color: "text-orange-500",
    order: 1,
  },
  {
    title: "HEALTHCARE",
    subtitle: "LEADERS",
    label: "HEALTHCARE LEADERS",
    icon: "Stethoscope",
    color: "text-[#3b8c2a]",
    order: 2,
  },
  {
    title: "GOVERNMENT",
    subtitle: "BODIES",
    label: "GOVERNMENT BODIES",
    icon: "Landmark",
    color: "text-blue-500",
    order: 3,
  },
  {
    title: "AYUSH",
    subtitle: "INDUSTRY",
    label: "AYUSH INDUSTRY",
    icon: "Leaf",
    color: "text-green-600",
    order: 4,
  },
  {
    title: "INTERNATIONAL",
    subtitle: "BUYERS",
    label: "INTERNATIONAL BUYERS",
    icon: "Globe",
    color: "text-indigo-600",
    order: 5,
  },
  {
    title: "HOSPITAL & CLINIC",
    subtitle: "PROCUREMENT TEAMS",
    label: "HOSPITAL & CLINIC PROCUREMENT TEAMS",
    icon: "Building2",
    color: "text-red-500",
    order: 6,
  },
];

export const getAudienceStripService = async () => {
  let data = await AudienceStrip.findOne();
  if (!data) {
    data = await AudienceStrip.create({
      enabled: true,
      items: DEFAULT_ITEMS,
    });
  }
  return data;
};

export const updateAudienceStripService = async (payload: any) => {
  let updateData = { ...payload };

  if (typeof updateData.items === "string") {
    try {
      updateData.items = JSON.parse(updateData.items);
    } catch {
      // keep
    }
  }

  if (Array.isArray(updateData.items)) {
    updateData.items = updateData.items.map((item: any, idx: number) => ({
      title: item.title ?? "",
      subtitle: item.subtitle ?? "",
      label: item.label ?? (item.title ? `${item.title} ${item.subtitle || ""}`.trim() : ""),
      icon: item.icon ?? "GraduationCap",
      color: item.color ?? "text-orange-500",
      order: item.order ?? idx + 1,
    }));
  }

  const data = await AudienceStrip.findOneAndUpdate(
    {},
    {
      enabled: updateData.enabled !== false,
      items: updateData.items ?? [],
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  return data;
};
