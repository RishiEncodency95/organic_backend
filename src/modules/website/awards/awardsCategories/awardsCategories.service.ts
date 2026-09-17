import AwardsCategories from "../../../../models/awards/awardsCategories.model";

const defaultBgs = [
  "bg-[#e8f5e9]",
  "bg-[#fff8e1]",
  "bg-[#fdf1e3]",
  "bg-[#e0f2f1]",
  "bg-[#e8f5e9]",
  "bg-[#f3e5f5]",
];

const defaultImages = [
  "/assets/awards/organic_food.png",
  "/assets/awards/ayush.png",
  "/assets/awards/organic_agriculture.png",
  "/assets/awards/natural.png",
  "/assets/awards/greentech.png",
  "/assets/awards/trade.png",
];

const DEFAULT_AWARDS_CATEGORIES_DATA = {
  enabled: true,
  eyebrow: "AWARD CATEGORIES",
  title: "Award Categories",
  items: [
    {
      id: 1,
      title: "Organic Food & Nutrition Excellence",
      image: "/assets/awards/organic_food.png",
      icon: "/assets/awards/organic_food.png",
      keyPoint1: "Organic Food Brand of the Year",
      keyPoint2: "Organic Beverage Brand of the Year",
      keyPoint3: "Nutrition Innovation Award",
      keyPoint4: "Emerging Organic Food Brand",
      items: [
        "Organic Food Brand of the Year",
        "Organic Beverage Brand of the Year",
        "Nutrition Innovation Award",
        "Emerging Organic Food Brand",
      ],
      points: [
        "Organic Food Brand of the Year",
        "Organic Beverage Brand of the Year",
        "Nutrition Innovation Award",
        "Emerging Organic Food Brand",
      ],
      cardBg: "bg-[#e8f5e9]",
    },
    {
      id: 2,
      title: "Ayush, Herbal & Wellness Excellence",
      image: "/assets/awards/ayush.png",
      icon: "/assets/awards/ayush.png",
      keyPoint1: "Ayurveda Brand Excellence",
      keyPoint2: "Herbal Product Innovation",
      keyPoint3: "Wellness Brand of the Year",
      keyPoint4: "Traditional Wellness Excellence",
      items: [
        "Ayurveda Brand Excellence",
        "Herbal Product Innovation",
        "Wellness Brand of the Year",
        "Traditional Wellness Excellence",
      ],
      points: [
        "Ayurveda Brand Excellence",
        "Herbal Product Innovation",
        "Wellness Brand of the Year",
        "Traditional Wellness Excellence",
      ],
      cardBg: "bg-[#fff8e1]",
    },
    {
      id: 3,
      title: "Organic Agriculture Excellence",
      image: "/assets/awards/organic_agriculture.png",
      icon: "/assets/awards/organic_agriculture.png",
      keyPoint1: "Organic Farmer Excellence",
      keyPoint2: "Organic Farming Innovation",
      keyPoint3: "Bio-Input Excellence",
      keyPoint4: "Sustainable Agriculture Initiative",
      items: [
        "Organic Farmer Excellence",
        "Organic Farming Innovation",
        "Bio-Input Excellence",
        "Sustainable Agriculture Initiative",
      ],
      points: [
        "Organic Farmer Excellence",
        "Organic Farming Innovation",
        "Bio-Input Excellence",
        "Sustainable Agriculture Initiative",
      ],
      cardBg: "bg-[#fdf1e3]",
    },
    {
      id: 4,
      title: "Natural Living & Personal Care Excellence",
      image: "/assets/awards/natural.png",
      icon: "/assets/awards/natural.png",
      keyPoint1: "Natural Beauty Brand",
      keyPoint2: "Natural Personal Care Innovation",
      keyPoint3: "Sustainable Lifestyle Brand",
      keyPoint4: "Emerging Natural Brand",
      items: [
        "Natural Beauty Brand",
        "Natural Personal Care Innovation",
        "Sustainable Lifestyle Brand",
        "Emerging Natural Brand",
      ],
      points: [
        "Natural Beauty Brand",
        "Natural Personal Care Innovation",
        "Sustainable Lifestyle Brand",
        "Emerging Natural Brand",
      ],
      cardBg: "bg-[#e0f2f1]",
    },
    {
      id: 5,
      title: "GreenTech & Sustainability Excellence",
      image: "/assets/awards/greentech.png",
      icon: "/assets/awards/greentech.png",
      keyPoint1: "GreenTech Innovation",
      keyPoint2: "Sustainable Packaging Excellence",
      keyPoint3: "AgriTech Innovation",
      keyPoint4: "Sustainability Initiative of the Year",
      items: [
        "GreenTech Innovation",
        "Sustainable Packaging Excellence",
        "AgriTech Innovation",
        "Sustainability Initiative of the Year",
      ],
      points: [
        "GreenTech Innovation",
        "Sustainable Packaging Excellence",
        "AgriTech Innovation",
        "Sustainability Initiative of the Year",
      ],
      cardBg: "bg-[#e8f5e9]",
    },
    {
      id: 6,
      title: "Trade, Certification & Global Business Excellence",
      image: "/assets/awards/trade.png",
      icon: "/assets/awards/trade.png",
      keyPoint1: "Organic Export Excellence",
      keyPoint2: "International Market Development",
      keyPoint3: "Certification & Quality Excellence",
      keyPoint4: "Organic Trade Promotion",
      items: [
        "Organic Export Excellence",
        "International Market Development",
        "Certification & Quality Excellence",
        "Organic Trade Promotion",
      ],
      points: [
        "Organic Export Excellence",
        "International Market Development",
        "Certification & Quality Excellence",
        "Organic Trade Promotion",
      ],
      cardBg: "bg-[#f3e5f5]",
    },
  ],
  categories: [] as any[],
};

DEFAULT_AWARDS_CATEGORIES_DATA.categories = DEFAULT_AWARDS_CATEGORIES_DATA.items;

export const getAwardsCategoriesService = async () => {
  let data = await AwardsCategories.findOne();
  if (!data) {
    data = await AwardsCategories.create(DEFAULT_AWARDS_CATEGORIES_DATA);
  }
  return data;
};

export const updateAwardsCategoriesService = async (payload: any) => {
  let updateData = { ...payload };

  let rawItems = updateData.items || updateData.categories;
  if (typeof rawItems === "string") {
    try {
      rawItems = JSON.parse(rawItems);
    } catch {}
  }

  if (Array.isArray(rawItems)) {
    const normalized = rawItems.map((it: any, idx: number) => {
      const p1 = it.keyPoint1 || it.points?.[0] || it.items?.[0] || "";
      const p2 = it.keyPoint2 || it.points?.[1] || it.items?.[1] || "";
      const p3 = it.keyPoint3 || it.points?.[2] || it.items?.[2] || "";
      const p4 = it.keyPoint4 || it.points?.[3] || it.items?.[3] || "";
      const pointsList = [p1, p2, p3, p4].filter(Boolean);
      const img = it.image || it.icon || defaultImages[idx % defaultImages.length];

      return {
        id: it.id || idx + 1,
        title: it.title || "",
        image: img,
        icon: img,
        keyPoint1: p1,
        keyPoint2: p2,
        keyPoint3: p3,
        keyPoint4: p4,
        items: pointsList.length > 0 ? pointsList : (Array.isArray(it.items) ? it.items : []),
        points: pointsList.length > 0 ? pointsList : (Array.isArray(it.items) ? it.items : []),
        cardBg: it.cardBg || defaultBgs[idx % defaultBgs.length],
      };
    });
    updateData.items = normalized;
    updateData.categories = normalized;
  }

  const data = await AwardsCategories.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
