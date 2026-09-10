import GlobalPlatform from "../../../../models/home/globalPlatform.model";

export const getGlobalPlatformService = async () => {
  let data = await GlobalPlatform.findOne();
  if (!data) {
    data = await GlobalPlatform.create({});
  }
  return data;
};

export const updateGlobalPlatformService = async (payload: any, files?: any) => {
  let updateData = { ...payload };

  if (typeof updateData.title === "string") {
    try {
      updateData.title = JSON.parse(updateData.title);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.listItems === "string") {
    try {
      updateData.listItems = JSON.parse(updateData.listItems);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.cards === "string") {
    try {
      updateData.cards = JSON.parse(updateData.cards);
    } catch {
      // keep as is
    }
  }

  if (files && Array.isArray(files)) {
    files.forEach((file: any) => {
      const match = file.fieldname.match(/^card_icon_(\d+)$/);
      if (match) {
        const index = parseInt(match[1], 10);
        if (updateData.cards && updateData.cards[index]) {
          updateData.cards[index].iconSrc = `/uploads/organic_expo/${file.filename}`;
        }
      }
    });
  }

  const data = await GlobalPlatform.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
