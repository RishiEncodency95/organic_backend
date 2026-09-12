import MsmePmsBanner from "../../../../../models/participate/msme_pms/msmePmsBanner.model";

export const getMsmePmsBannerService = async () => {
  let data = await MsmePmsBanner.findOne();
  if (!data) {
    data = await MsmePmsBanner.create({});
  }
  return data;
};

export const updateMsmePmsBannerService = async (payload: any) => {
  const data = await MsmePmsBanner.findOneAndUpdate({}, payload, { new: true, upsert: true });
  return data;
};
