import AboutStrip from "../../../../../models/about/aboutStrip.model";

export const getAboutStripService = async () => {
  let data = await AboutStrip.findOne();
  if (!data) {
    data = await AboutStrip.create({});
  }
  return data;
};

export const updateAboutStripService = async (payload: any) => {
  let updateData = { ...payload };

  if (typeof updateData.items === "string") {
    try {
      updateData.items = JSON.parse(updateData.items);
    } catch {
      // keep as is
    }
  }

  const data = await AboutStrip.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
