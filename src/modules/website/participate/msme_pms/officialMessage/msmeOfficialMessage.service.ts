import MsmeOfficialMessage from "../../../../../models/participate/msme_pms/msmeOfficialMessage.model";

export const getMsmeOfficialMessageService = async () => {
  let data = await MsmeOfficialMessage.findOne();
  if (!data) {
    data = await MsmeOfficialMessage.create({});
  }
  return data;
};

export const updateMsmeOfficialMessageService = async (payload: any) => {
  const data = await MsmeOfficialMessage.findOneAndUpdate({}, payload, { new: true, upsert: true });
  return data;
};
