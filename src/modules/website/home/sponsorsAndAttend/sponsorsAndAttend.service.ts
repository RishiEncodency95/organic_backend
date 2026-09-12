import SponsorsAndAttend from "../../../../models/home/sponsorsAndAttend.model";

export const getSponsorsAndAttendService = async () => {
  let data = await SponsorsAndAttend.findOne();
  if (!data) {
    data = await SponsorsAndAttend.create({});
  } else {
    let needsSave = false;
    if (data.enabled === undefined) {
      data.enabled = true;
      needsSave = true;
    }
    if (!data.feature1Title && data.leftSection?.itemsLeft?.[0]?.title) {
      data.feature1Title = data.leftSection.itemsLeft[0].title;
      data.feature1Desc = data.leftSection.itemsLeft[0].desc;
      needsSave = true;
    }
    if (!data.feature3Title && data.leftSection?.itemsLeft?.[1]?.title) {
      data.feature3Title = data.leftSection.itemsLeft[1].title;
      data.feature3Desc = data.leftSection.itemsLeft[1].desc;
      needsSave = true;
    }
    if (!data.feature5Title && data.leftSection?.itemsLeft?.[2]?.title) {
      data.feature5Title = data.leftSection.itemsLeft[2].title;
      data.feature5Desc = data.leftSection.itemsLeft[2].desc;
      needsSave = true;
    }
    if (!data.feature2Title && data.leftSection?.itemsRight?.[0]?.title) {
      data.feature2Title = data.leftSection.itemsRight[0].title;
      data.feature2Desc = data.leftSection.itemsRight[0].desc;
      needsSave = true;
    }
    if (!data.feature4Title && data.leftSection?.itemsRight?.[1]?.title) {
      data.feature4Title = data.leftSection.itemsRight[1].title;
      data.feature4Desc = data.leftSection.itemsRight[1].desc;
      needsSave = true;
    }
    if (!data.feature6Title && data.leftSection?.itemsRight?.[2]?.title) {
      data.feature6Title = data.leftSection.itemsRight[2].title;
      data.feature6Desc = data.leftSection.itemsRight[2].desc;
      needsSave = true;
    }
    if (!data.keyPoint1 && data.rightSection?.items?.[0]?.label) {
      data.keyPoint1 = data.rightSection.items[0].label;
      needsSave = true;
    }
    if (needsSave) {
      await data.save();
    }
  }
  return data;
};

export const updateSponsorsAndAttendService = async (payload: any, files?: any) => {
  let updateData = { ...payload };

  if (typeof updateData.leftSection === "string") {
    try {
      updateData.leftSection = JSON.parse(updateData.leftSection);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.centerSection === "string") {
    try {
      updateData.centerSection = JSON.parse(updateData.centerSection);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.rightSection === "string") {
    try {
      updateData.rightSection = JSON.parse(updateData.rightSection);
    } catch {
      // keep as is
    }
  }

  // Synchronize flat feature fields with leftSection
  const feature1Title = updateData.feature1Title ?? updateData.leftSection?.itemsLeft?.[0]?.title ?? "DISCOVER";
  const feature1Desc = updateData.feature1Desc ?? updateData.leftSection?.itemsLeft?.[0]?.desc ?? "Explore the latest organic products and eco-friendly services driving a sustainable future.";
  const feature3Title = updateData.feature3Title ?? updateData.leftSection?.itemsLeft?.[1]?.title ?? "CONNECT";
  const feature3Desc = updateData.feature3Desc ?? updateData.leftSection?.itemsLeft?.[1]?.desc ?? "Meet leading organic brands, manufacturers and sustainable suppliers under one roof.";
  const feature5Title = updateData.feature5Title ?? updateData.leftSection?.itemsLeft?.[2]?.title ?? "GROW";
  const feature5Desc = updateData.feature5Desc ?? updateData.leftSection?.itemsLeft?.[2]?.desc ?? "Unlock new green business opportunities, partnerships and eco-investment possibilities.";

  const feature2Title = updateData.feature2Title ?? updateData.leftSection?.itemsRight?.[0]?.title ?? "LEARN";
  const feature2Desc = updateData.feature2Desc ?? updateData.leftSection?.itemsRight?.[0]?.desc ?? "Attend seminars, workshops and live demos by organic agriculture and sustainability experts.";
  const feature4Title = updateData.feature4Title ?? updateData.leftSection?.itemsRight?.[1]?.title ?? "SOURCE";
  const feature4Desc = updateData.feature4Desc ?? updateData.leftSection?.itemsRight?.[1]?.desc ?? "Find trusted organic suppliers, distributors and eco-franchise opportunities.";
  const feature6Title = updateData.feature6Title ?? updateData.leftSection?.itemsRight?.[2]?.title ?? "STAY AHEAD";
  const feature6Desc = updateData.feature6Desc ?? updateData.leftSection?.itemsRight?.[2]?.desc ?? "Stay updated with market trends, conscious consumer insights and future organic industry developments.";

  updateData.feature1Title = feature1Title;
  updateData.feature1Desc = feature1Desc;
  updateData.feature2Title = feature2Title;
  updateData.feature2Desc = feature2Desc;
  updateData.feature3Title = feature3Title;
  updateData.feature3Desc = feature3Desc;
  updateData.feature4Title = feature4Title;
  updateData.feature4Desc = feature4Desc;
  updateData.feature5Title = feature5Title;
  updateData.feature5Desc = feature5Desc;
  updateData.feature6Title = feature6Title;
  updateData.feature6Desc = feature6Desc;

  updateData.leftSection = {
    titlePrefix: updateData.titlePrefix || updateData.leftSection?.titlePrefix || "WHY",
    titleHighlight: updateData.titleHighlight || updateData.leftSection?.titleHighlight || "ATTEND?",
    description: updateData.description || updateData.leftSection?.description || "Explore innovations, build connections and gain insights that drive better health and stronger businesses.",
    itemsLeft: [
      { title: feature1Title, desc: feature1Desc, icon: "Lightbulb" },
      { title: feature3Title, desc: feature3Desc, icon: "Handshake" },
      { title: feature5Title, desc: feature5Desc, icon: "TrendingUp" },
    ],
    itemsRight: [
      { title: feature2Title, desc: feature2Desc, icon: "BookOpen" },
      { title: feature4Title, desc: feature4Desc, icon: "PackageSearch" },
      { title: feature6Title, desc: feature6Desc, icon: "Zap" },
    ]
  };

  // Synchronize key points with rightSection.items
  const rawKeyPoints = [
    updateData.keyPoint1 || "Organic Distributors, Wholesalers & Retailers",
    updateData.keyPoint2 || "Eco-Importers & Exporters",
    updateData.keyPoint3 || "Ayurvedic Institutions & Wellness Centers",
    updateData.keyPoint4 || "Nutritionists, Farmers & Wellness Experts",
    updateData.keyPoint5 || "Gym Owners, Spa & Eco-Fitness Professionals",
    updateData.keyPoint6 || "Organic Farming & Natural Product Buyers",
    updateData.keyPoint7 || "Sustainable Packaging & Eco-friendly Brands",
    updateData.keyPoint8 || "Investors, Franchise Seekers & Green Business",
    updateData.keyPoint9 || "Supermarkets & Organic Grocery Chains",
    updateData.keyPoint10 || "Health-Conscious Consumers & Eco-Enthusiasts",
  ];

  const defaultIcons = ["ShoppingCart", "Globe", "Hospital", "Stethoscope", "Dumbbell", "Sprout", "Flower2", "Handshake", "Users", "Heart"];

  updateData.rightSection = {
    title: updateData.rightSection?.title || "WHO SHOULD ATTEND?",
    bottomText: updateData.rightSection?.bottomText || "Whether you're sourcing, learning or networking — this is the place to be!",
    items: rawKeyPoints.map((label, idx) => ({
      label,
      icon: defaultIcons[idx] || "Users"
    }))
  };

  if (updateData.enabled !== undefined) {
    updateData.enabled = updateData.enabled === true || updateData.enabled === "true";
  }

  if (files && files.image && files.image[0]) {
    updateData.image = `/uploads/organic_expo/${files.image[0].filename}`;
  }

  const data = await SponsorsAndAttend.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
