import AwardsGrandAwards from "../../../../models/awards/awardsGrandAwards.model";

const DEFAULT_ITEMS = [
  {
    id: 1,
    image: "/assets/awards/organic_enterpreneur.png",
    icon: "organic_enterpreneur",
    title: "Organic Entrepreneur of the Year",
    label: "Organic Entrepreneur of the Year",
  },
  {
    id: 2,
    image: "/assets/awards/organic_startup.png",
    icon: "organic_startup",
    title: "Organic Startup of the Year",
    label: "Organic Startup of the Year",
  },
  {
    id: 3,
    image: "/assets/awards/organic_brand.png",
    icon: "organic_brand",
    title: "Organic Brand of the Year",
    label: "Organic Brand of the Year",
  },
  {
    id: 4,
    image: "/assets/awards/innovation.png",
    icon: "innovation",
    title: "Innovation of the Year",
    label: "Innovation of the Year",
  },
  {
    id: 5,
    image: "/assets/awards/sustainability.png",
    icon: "sustainability",
    title: "Sustainability Leadership Award",
    label: "Sustainability Leadership Award",
  },
  {
    id: 6,
    image: "/assets/awards/lifetime_achievement.png",
    icon: "lifetime_achievement",
    title: "Lifetime Achievement Award",
    label: "Lifetime Achievement Award",
  },
];

const DEFAULT_GRAND_AWARDS_DATA = {
  enabled: true,
  eyebrow: "GRAND HONOURS",
  title: "Prestigious Grand Awards",
  awards: DEFAULT_ITEMS,
  items: DEFAULT_ITEMS,
};

const normalizeItems = (raw: any[]) => {
  if (!Array.isArray(raw)) return DEFAULT_ITEMS;
  const iconMap: Record<string, string> = {
    entrepreneur: "organic_enterpreneur",
    startup: "organic_startup",
    brand: "organic_brand",
    innovation: "innovation",
    sustainability: "sustainability",
    lifetime: "lifetime_achievement",
  };
  return raw.map((it: any, idx: number) => {
    const fallback = DEFAULT_ITEMS[idx % DEFAULT_ITEMS.length];
    const text = it.title || it.label || fallback.title;
    let img = it.image || it.icon || "";
    if (!img || (!img.startsWith("/") && !img.startsWith("http"))) {
      if (img) {
        const mapped = iconMap[img] || img;
        img = `/assets/awards/${mapped}.png`;
      } else {
        img = fallback.image;
      }
    }
    return {
      id: it.id || idx + 1,
      title: text,
      label: text,
      image: img,
      icon: img,
    };
  });
};

export const getAwardsGrandAwardsService = async () => {
  let data = await AwardsGrandAwards.findOne();
  if (!data) {
    data = await AwardsGrandAwards.create(DEFAULT_GRAND_AWARDS_DATA);
  } else {
    // If eyebrow or items are empty, ensure defaults
    let needsSave = false;
    if (!data.eyebrow) {
      data.eyebrow = "GRAND HONOURS";
      needsSave = true;
    }
    const rawList = (data.items && data.items.length > 0) ? data.items : data.awards;
    const normalized = normalizeItems(rawList);
    if (!data.items || data.items.length === 0) {
      data.items = normalized as any;
      needsSave = true;
    }
    if (!data.awards || data.awards.length === 0 || !data.awards[0]?.image) {
      data.awards = normalized as any;
      needsSave = true;
    }
    if (needsSave) {
      await data.save();
    }
  }
  return data;
};

export const updateAwardsGrandAwardsService = async (payload: any) => {
  let updateData = { ...payload };

  let rawList = updateData.items || updateData.awards;
  if (typeof rawList === "string") {
    try {
      rawList = JSON.parse(rawList);
    } catch {}
  }

  const normalized = normalizeItems(rawList);
  updateData.items = normalized;
  updateData.awards = normalized;

  if (updateData.eyebrow === undefined) {
    updateData.eyebrow = "GRAND HONOURS";
  }

  const data = await AwardsGrandAwards.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};

