import MsmeSupportCover from "../../../../../models/participate/msme_pms/msmeSupportCover.model";

export const getMsmeSupportCoverService = async () => {
  let data = await MsmeSupportCover.findOne();
  if (!data) {
    data = await MsmeSupportCover.create({});
  }
  return data;
};

export const updateMsmeSupportCoverService = async (payload: any) => {
  const data = await MsmeSupportCover.findOneAndUpdate({}, payload, { new: true, upsert: true });
  return data;
};
