import MsmeWhyParticipate from "../../../../../models/participate/msme_pms/msmeWhyParticipate.model";

export const getMsmeWhyParticipateService = async () => {
  let data = await MsmeWhyParticipate.findOne();
  if (!data) {
    data = await MsmeWhyParticipate.create({});
  }
  return data;
};

export const updateMsmeWhyParticipateService = async (payload: any) => {
  const data = await MsmeWhyParticipate.findOneAndUpdate({}, payload, { new: true, upsert: true });
  return data;
};
