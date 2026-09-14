import AwardsCategories from "../../../../models/awards/awardsCategories.model";

const DEFAULT_AWARDS_CATEGORIES_DATA = {
  enabled: true,
  title: "Award Categories",
  categories: [
    {
      id: 1,
      icon: "organic_food",
      title: "Organic Food & Nutrition Excellence",
      items: [
        "Organic Food Brand of the Year",
        "Organic Beverage Brand of the Year",
        "Nutrition Innovation Award",
        "Emerging Organic Food Brand",
      ],
      cardBg: "bg-[#e8f5e9]",
    },
    {
      id: 2,
      icon: "ayush",
      title: "Ayush, Herbal & Wellness Excellence",
      items: [
        "Ayurveda Brand Excellence",
        "Herbal Product Innovation",
        "Wellness Brand of the Year",
        "Traditional Wellness Excellence",
      ],
      cardBg: "bg-[#fff8e1]",
    },
    {
      id: 3,
      icon: "organic_agriculture",
      title: "Organic Agriculture Excellence",
      items: [
        "Organic Farmer Excellence",
        "Organic Farming Innovation",
        "Bio-Input Excellence",
        "Sustainable Agriculture Initiative",
      ],
      cardBg: "bg-[#fdf1e3]",
    },
    {
      id: 4,
      icon: "natural",
      title: "Natural Living & Personal Care Excellence",
      items: [
        "Natural Beauty Brand",
        "Natural Personal Care Innovation",
        "Sustainable Lifestyle Brand",
        "Emerging Natural Brand",
      ],
      cardBg: "bg-[#e0f2f1]",
    },
    {
      id: 5,
      icon: "greentech",
      title: "GreenTech & Sustainability Excellence",
      items: [
        "GreenTech Innovation",
        "Sustainable Packaging Excellence",
        "AgriTech Innovation",
        "Sustainability Initiative of the Year",
      ],
      cardBg: "bg-[#e8f5e9]",
    },
    {
      id: 6,
      icon: "trade",
      title: "Trade, Certification & Global Business Excellence",
      items: [
        "Organic Export Excellence",
        "International Market Development",
        "Certification & Quality Excellence",
        "Organic Trade Promotion",
      ],
      cardBg: "bg-[#f3e5f5]",
    },
  ],
};

export const getAwardsCategoriesService = async () => {
  let data = await AwardsCategories.findOne();
  if (!data) {
    data = await AwardsCategories.create(DEFAULT_AWARDS_CATEGORIES_DATA);
  }
  return data;
};

export const updateAwardsCategoriesService = async (payload: any) => {
  let updateData = { ...payload };

  if (typeof updateData.categories === "string") {
    try {
      updateData.categories = JSON.parse(updateData.categories);
    } catch {}
  }

  const data = await AwardsCategories.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
