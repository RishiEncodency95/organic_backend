import GlobalPlatform from "../../../../models/home/globalPlatform.model";

const DEFAULT_CARDS = [
  {
    title: "GLOBAL CONNECTIONS",
    description:
      "Connect with global leaders in organic trade and sustainable business. Expand your network across international markets to build long-term, profitable relationships.",
    desc: "Connect with global leaders in organic trade and sustainable business. Expand your network across international markets to build long-term, profitable relationships.",
    iconSrc: "",
    iconAlt: "Global Connections",
    iconWidth: 90,
    iconHeight: 90,
    bgClass: "bg-gradient-to-b from-white to-blue-50/80",
    borderClass: "border-blue-200",
  },
  {
    title: "INTERNATIONAL ALLIANCES",
    description:
      "Forge strategic alliances with prominent international organizations, trade bodies, and embassies to unlock massive cross-border trade opportunities.",
    desc: "Forge strategic alliances with prominent international organizations, trade bodies, and embassies to unlock massive cross-border trade opportunities.",
    iconSrc: "",
    iconAlt: "International Alliances",
    iconWidth: 120,
    iconHeight: 120,
    bgClass: "bg-gradient-to-b from-white to-orange-50/80",
    borderClass: "border-orange-200",
  },
  {
    title: "POLICY & KNOWLEDGE",
    description:
      "Engage directly with global policy makers, researchers, and leaders driving regulatory changes and sustainability standards in the organic ecosystem.",
    desc: "Engage directly with global policy makers, researchers, and leaders driving regulatory changes and sustainability standards in the organic ecosystem.",
    iconSrc: "",
    iconAlt: "Policy & Knowledge",
    iconWidth: 120,
    iconHeight: 120,
    bgClass: "bg-gradient-to-b from-white to-green-50/80",
    borderClass: "border-green-200",
  },
  {
    title: "INVESTMENT & INNOVATION",
    description:
      "Discover high-growth investment opportunities and explore cutting-edge, innovative solutions presented by dynamic startups in the wellness industry.",
    desc: "Discover high-growth investment opportunities and explore cutting-edge, innovative solutions presented by dynamic startups in the wellness industry.",
    iconSrc: "",
    iconAlt: "Investment & Innovation",
    iconWidth: 130,
    iconHeight: 130,
    bgClass: "bg-gradient-to-b from-white to-purple-50/80",
    borderClass: "border-purple-200",
  },
];

const DEFAULT_LIST_ITEMS = [
  "International Exhibitors & Global Brands",
  "Buyers, Distributors & Importers",
  "Research & Innovation | Startups",
  "Investors, Financial Institutions",
  "Government Bodies, Embassies & Policy Makers",
];

export const getGlobalPlatformService = async () => {
  let data = await GlobalPlatform.findOne();
  if (!data) {
    data = await GlobalPlatform.create({
      enabled: true,
      eyebrow: "FROM INDIA TO THE WORLD",
      badge: "FROM INDIA TO THE WORLD",
      titlePrimary: "From a National Expo to a",
      titleSecondary: "Global Platform",
      description:
        "Bharat Organic Expo is India's most influential platform connecting organic products, people and possibilities.",
      keyPoint1: DEFAULT_LIST_ITEMS[0],
      keyPoint2: DEFAULT_LIST_ITEMS[1],
      keyPoint3: DEFAULT_LIST_ITEMS[2],
      keyPoint4: DEFAULT_LIST_ITEMS[3],
      keyPoint5: DEFAULT_LIST_ITEMS[4],
      listItems: DEFAULT_LIST_ITEMS,
      items: DEFAULT_CARDS,
      cards: DEFAULT_CARDS,
    });
  } else {
    let needsSave = false;
    if (!data.keyPoint1) {
      data.keyPoint1 = DEFAULT_LIST_ITEMS[0];
      needsSave = true;
    }
    if (!data.keyPoint2) {
      data.keyPoint2 = DEFAULT_LIST_ITEMS[1];
      needsSave = true;
    }
    if (!data.keyPoint3) {
      data.keyPoint3 = DEFAULT_LIST_ITEMS[2];
      needsSave = true;
    }
    if (!data.keyPoint4) {
      data.keyPoint4 = DEFAULT_LIST_ITEMS[3];
      needsSave = true;
    }
    if (!data.keyPoint5) {
      data.keyPoint5 = DEFAULT_LIST_ITEMS[4];
      needsSave = true;
    }
    if (!data.listItems || data.listItems.length === 0) {
      data.listItems = [
        data.keyPoint1,
        data.keyPoint2,
        data.keyPoint3,
        data.keyPoint4,
        data.keyPoint5,
      ];
      needsSave = true;
    }
    if (needsSave) {
      await data.save();
    }
  }
  return data;
};

export const updateGlobalPlatformService = async (payload: any, files?: any) => {
  let updateData = { ...payload };

  if (typeof updateData.listItems === "string") {
    try {
      updateData.listItems = JSON.parse(updateData.listItems);
    } catch {
      // keep as is
    }
  }

  // Handle keyPoint1..keyPoint5 and sync with listItems
  if (
    updateData.keyPoint1 !== undefined ||
    updateData.keyPoint2 !== undefined ||
    updateData.keyPoint3 !== undefined ||
    updateData.keyPoint4 !== undefined ||
    updateData.keyPoint5 !== undefined
  ) {
    updateData.keyPoint1 = updateData.keyPoint1 || DEFAULT_LIST_ITEMS[0];
    updateData.keyPoint2 = updateData.keyPoint2 || DEFAULT_LIST_ITEMS[1];
    updateData.keyPoint3 = updateData.keyPoint3 || DEFAULT_LIST_ITEMS[2];
    updateData.keyPoint4 = updateData.keyPoint4 || DEFAULT_LIST_ITEMS[3];
    updateData.keyPoint5 = updateData.keyPoint5 || DEFAULT_LIST_ITEMS[4];
    updateData.listItems = [
      updateData.keyPoint1,
      updateData.keyPoint2,
      updateData.keyPoint3,
      updateData.keyPoint4,
      updateData.keyPoint5,
    ];
  } else if (Array.isArray(updateData.listItems) && updateData.listItems.length > 0) {
    updateData.keyPoint1 = updateData.listItems[0] || DEFAULT_LIST_ITEMS[0];
    updateData.keyPoint2 = updateData.listItems[1] || DEFAULT_LIST_ITEMS[1];
    updateData.keyPoint3 = updateData.listItems[2] || DEFAULT_LIST_ITEMS[2];
    updateData.keyPoint4 = updateData.listItems[3] || DEFAULT_LIST_ITEMS[3];
    updateData.keyPoint5 = updateData.listItems[4] || DEFAULT_LIST_ITEMS[4];
  }

  // Support items or cards from admin
  let rawCards = updateData.items || updateData.cards;
  if (typeof rawCards === "string") {
    try {
      rawCards = JSON.parse(rawCards);
    } catch {
      // keep
    }
  }

  if (Array.isArray(rawCards)) {
    // Filter out obsolete cards if present (Trusted Brands, Targeted Audience, Business Growth)
    const filtered = rawCards.filter(
      (c: any) =>
        !/trusted brands|targeted audience|business growth/i.test(c.title || "")
    );
    const mapped = filtered.map((c: any, idx: number) => {
      const fallback = DEFAULT_CARDS[idx % DEFAULT_CARDS.length];
      return {
        title: c.title || fallback.title,
        description: c.description || c.desc || fallback.description,
        desc: c.description || c.desc || fallback.desc,
        iconSrc: c.iconSrc || fallback.iconSrc,
        iconAlt: c.iconAlt || fallback.iconAlt,
        iconWidth: c.iconWidth || fallback.iconWidth,
        iconHeight: c.iconHeight || fallback.iconHeight,
        bgClass: c.bgClass || fallback.bgClass,
        borderClass: c.borderClass || fallback.borderClass,
      };
    });

    updateData.cards = mapped;
    updateData.items = mapped;
  }

  if (updateData.eyebrow && !updateData.badge) {
    updateData.badge = updateData.eyebrow;
  }
  if (updateData.badge && !updateData.eyebrow) {
    updateData.eyebrow = updateData.badge;
  }

  if (updateData.enabled !== undefined) {
    updateData.enabled = updateData.enabled === true || updateData.enabled === "true";
  }

  const data = await GlobalPlatform.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });
  return data;
};
