import SponsorsAndAttend from "../../../../models/home/sponsorsAndAttend.model";

export const getSponsorsAndAttendService = async () => {
  let data = await SponsorsAndAttend.findOne();
  if (!data) {
    data = await SponsorsAndAttend.create({});
  }
  return data;
};

export const updateSponsorsAndAttendService = async (payload: any) => {
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

  const data = await SponsorsAndAttend.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
