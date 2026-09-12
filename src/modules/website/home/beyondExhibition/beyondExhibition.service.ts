import BeyondExhibition, { IExtraItem } from "../../../../models/home/beyondExhibition.model";

const normalizeBeyondItems = (list: any[]): IExtraItem[] => {
  return list.map((item: any) => {
    let fullTitle = item.title || "";
    if (item.title2) {
      fullTitle = `${item.title} ${item.title2}`.trim();
    }
    const description = item.description ?? item.subtitle ?? "";
    const subtitle = item.subtitle ?? item.description ?? "";
    const icon = item.icon || "Users";

    return {
      title: fullTitle,
      title2: item.title2 || "",
      description,
      subtitle,
      icon,
    };
  });
};

export const getBeyondExhibitionService = async () => {
  let data = await BeyondExhibition.findOne();
  if (!data) {
    data = await BeyondExhibition.create({});
  } else {
    let needsSave = false;
    if (data.enabled === undefined) {
      data.enabled = true;
      needsSave = true;
    }
    if (!data.items || data.items.length === 0) {
      if (data.extras && data.extras.length > 0) {
        data.items = normalizeBeyondItems(data.extras) as any;
        needsSave = true;
      }
    }
    if (!data.extras || data.extras.length === 0) {
      if (data.items && data.items.length > 0) {
        data.extras = normalizeBeyondItems(data.items) as any;
        needsSave = true;
      }
    }
    if (needsSave) {
      await data.save();
    }
  }
  return data;
};

export const updateBeyondExhibitionService = async (payload: any, files?: any) => {
  let updateData = { ...payload };

  if (typeof updateData.extras === "string") {
    try {
      updateData.extras = JSON.parse(updateData.extras);
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

  const rawList = updateData.items || updateData.extras;
  if (Array.isArray(rawList)) {
    const normalized = normalizeBeyondItems(rawList);
    updateData.items = normalized;
    updateData.extras = normalized;
  }

  if (updateData.enabled !== undefined) {
    updateData.enabled = updateData.enabled === true || updateData.enabled === "true";
  }

  if (files && files.image && files.image[0]) {
    updateData.image = `/uploads/organic_expo/${files.image[0].filename}`;
  }

  const data = await BeyondExhibition.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
