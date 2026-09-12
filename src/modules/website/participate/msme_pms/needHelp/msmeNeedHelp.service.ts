import MsmeNeedHelp from "../../../../../models/participate/msme_pms/msmeNeedHelp.model";

export const getMsmeNeedHelpService = async () => {
  let data = await MsmeNeedHelp.findOne();
  if (!data) {
    data = await MsmeNeedHelp.create({});
  }
  return data;
};

export const updateMsmeNeedHelpService = async (payload: any) => {
  const data = await MsmeNeedHelp.findOneAndUpdate({}, payload, { new: true, upsert: true });
  return data;
};
