import ExpoCategories from "../../../../models/home/expoCategories.model";

const normalizeCategories = (list: any[]) => {
  if (!Array.isArray(list)) return [];
  return list.map((item: any) => ({
    icon: item.icon || "",
    title: item.title || "",
    desc: item.description || item.desc || "",
    description: item.description || item.desc || "",
    color: item.color || "",
    image: item.image || "",
    imageAlt: item.imageAlt || item.title || "Category",
    href: item.href || item.link || "/exhibition-categories",
    link: item.href || item.link || "/exhibition-categories",
    exploreText: item.exploreText || "Explore",
  }));
};

export const getExpoCategoriesService = async () => {
  let data = await ExpoCategories.findOne();
  if (!data) {
    data = await ExpoCategories.create({});
  } else {
    let needsSave = false;
    if (data.enabled === undefined) { data.enabled = true; needsSave = true; }
    if (!data.buttonHref) { data.buttonHref = data.buttonLink || "/exhibition-categories"; needsSave = true; }
    if (!data.buttonLink) { data.buttonLink = data.buttonHref || "/exhibition-categories"; needsSave = true; }
    if (!data.items || data.items.length === 0) {
      if (data.categories && data.categories.length > 0) {
        data.items = normalizeCategories(data.categories) as any;
        needsSave = true;
      }
    }
    if (needsSave) {
      await data.save();
    }
  }
  return data;
};

export const updateExpoCategoriesService = async (payload: any, files?: any) => {
  let updateData = { ...payload };

  if (typeof updateData.categories === "string") {
    try {
      updateData.categories = JSON.parse(updateData.categories);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.items === "string") {
    try {
      updateData.items = JSON.parse(updateData.items);
    } catch {
      // keep as is
    }
  }

  const rawList = updateData.items || updateData.categories;
  if (Array.isArray(rawList)) {
    const normalized = normalizeCategories(rawList);
    updateData.categories = normalized;
    updateData.items = normalized;
  }

  if (updateData.buttonHref && !updateData.buttonLink) {
    updateData.buttonLink = updateData.buttonHref;
  }
  if (updateData.buttonLink && !updateData.buttonHref) {
    updateData.buttonHref = updateData.buttonLink;
  }

  if (updateData.enabled !== undefined) {
    updateData.enabled = updateData.enabled === true || updateData.enabled === "true";
  }

  if (files && Array.isArray(files)) {
    files.forEach((file: any) => {
      const match = file.fieldname.match(/^category_image_(\d+)$/);
      if (match) {
        const index = parseInt(match[1], 10);
        if (updateData.categories && updateData.categories[index]) {
          updateData.categories[index].image = `/uploads/organic_expo/${file.filename}`;
        }
        if (updateData.items && updateData.items[index]) {
          updateData.items[index].image = `/uploads/organic_expo/${file.filename}`;
        }
      }
    });
  }

  const data = await ExpoCategories.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });
  return data;
};

