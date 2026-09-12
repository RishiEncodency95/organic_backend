import MsmeFeatureStrip from "../../../../../models/participate/msme_pms/msmeFeatureStrip.model";

export const getMsmeFeatureStripService = async () => {
  let data = await MsmeFeatureStrip.findOne();
  if (!data) {
    data = await MsmeFeatureStrip.create({});
  }
  return data;
};

export const updateMsmeFeatureStripService = async (payload: any) => {
  const data = await MsmeFeatureStrip.findOneAndUpdate({}, payload, { new: true, upsert: true });
  return data;
};
