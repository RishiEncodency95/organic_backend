import MsmeWhatsNext from "../../../../../models/participate/msme_pms/msmeWhatsNext.model";

export const getMsmeWhatsNextService = async () => {
  let data = await MsmeWhatsNext.findOne();
  if (!data) {
    data = await MsmeWhatsNext.create({});
  }
  return data;
};

export const updateMsmeWhatsNextService = async (payload: any) => {
  const data = await MsmeWhatsNext.findOneAndUpdate({}, payload, { new: true, upsert: true });
  return data;
};
