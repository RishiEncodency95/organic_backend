import MsmeOfficialMessage from "../../../../../models/participate/msme_pms/msmeOfficialMessage.model";

export const getMsmeOfficialMessageService = async () => {
  let data = await MsmeOfficialMessage.findOne();
  if (!data) {
    data = await MsmeOfficialMessage.create({});
  }
  return data;
};

const ALLOWED_FIELDS = [
  "enabled",
  "eyebrow",
  "title",
  "subtitle",
  "messageTitle",
  "quote",
  "authorName",
  "authorDesignation",
  "videoUrl",
  "thumbnailImage",
  "thumbnailAlt",
] as const;

export const updateMsmeOfficialMessageService = async (payload: any) => {
  const updateData: Record<string, any> = {};
  for (const field of ALLOWED_FIELDS) {
    if (payload?.[field] !== undefined) updateData[field] = payload[field];
  }
  if (typeof updateData.enabled === "string") {
    updateData.enabled = updateData.enabled !== "false";
  }

  const data = await MsmeOfficialMessage.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });
  return data;
};
