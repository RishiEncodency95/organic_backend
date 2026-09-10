import EventOverview from "../../../../../models/about/eventOverview.model";

export const getEventOverviewService = async () => {
  let data = await EventOverview.findOne();
  if (!data) {
    data = await EventOverview.create({});
  }
  return data;
};

export const updateEventOverviewService = async (payload: any) => {
  let updateData = { ...payload };

  if (typeof updateData.paragraphs === "string") {
    try {
      updateData.paragraphs = JSON.parse(updateData.paragraphs);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.sectors === "string") {
    try {
      updateData.sectors = JSON.parse(updateData.sectors);
    } catch {
      // keep as is
    }
  }

  const data = await EventOverview.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
