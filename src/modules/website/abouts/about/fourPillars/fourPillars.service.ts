import FourPillars from "../../../../../models/about/fourPillars.model";

export const getFourPillarsService = async () => {
  let data = await FourPillars.findOne();
  if (!data) {
    data = await FourPillars.create({});
  }
  return data;
};

export const updateFourPillarsService = async (payload: any, files?: any) => {
  let updateData = { ...payload };

  if (typeof updateData.pillars === "string") {
    try {
      updateData.pillars = JSON.parse(updateData.pillars);
    } catch {
      // keep as is
    }
  }

  if (files && Array.isArray(files)) {
    files.forEach((file: any) => {
      const match = file.fieldname.match(/^pillar_image_(\d+)$/);
      if (match) {
        const index = parseInt(match[1], 10);
        if (updateData.pillars && updateData.pillars[index]) {
          updateData.pillars[index].img = `/uploads/organic_expo/${file.filename}`;
        }
      }
    });
  }

  const data = await FourPillars.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
