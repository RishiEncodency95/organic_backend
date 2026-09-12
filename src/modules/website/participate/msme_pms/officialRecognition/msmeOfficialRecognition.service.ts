import MsmeOfficialRecognition from "../../../../../models/participate/msme_pms/msmeOfficialRecognition.model";

export const getMsmeOfficialRecognitionService = async () => {
  let data = await MsmeOfficialRecognition.findOne();
  if (!data) {
    data = await MsmeOfficialRecognition.create({});
  }
  return data;
};

export const updateMsmeOfficialRecognitionService = async (payload: any) => {
  const data = await MsmeOfficialRecognition.findOneAndUpdate({}, payload, { new: true, upsert: true });
  return data;
};
