import VisionMission from "../../../../../models/about/visionMission.model";

export const getVisionMissionService = async () => {
  let data = await VisionMission.findOne();
  if (!data) {
    data = await VisionMission.create({});
  }
  return data;
};

export const updateVisionMissionService = async (payload: any) => {
  let updateData = { ...payload };

  if (typeof updateData.vision === "string") {
    try {
      updateData.vision = JSON.parse(updateData.vision);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.mission === "string") {
    try {
      updateData.mission = JSON.parse(updateData.mission);
    } catch {
      // keep as is
    }
  }

  const data = await VisionMission.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
