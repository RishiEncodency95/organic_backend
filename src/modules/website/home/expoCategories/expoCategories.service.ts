import ExpoCategories from "../../../../models/home/expoCategories.model";

export const getExpoCategoriesService = async () => {
  let data = await ExpoCategories.findOne();
  if (!data) {
    data = await ExpoCategories.create({});
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

  if (files && Array.isArray(files)) {
    files.forEach((file: any) => {
      const match = file.fieldname.match(/^category_image_(\d+)$/);
      if (match) {
        const index = parseInt(match[1], 10);
        if (updateData.categories && updateData.categories[index]) {
          updateData.categories[index].image = `/uploads/organic_expo/${file.filename}`;
        }
      }
    });
  }

  const data = await ExpoCategories.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
