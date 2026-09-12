import MsmeSupportSection from "../../../../../models/participate/msme_pms/msmeSupportSection.model";

export const getMsmeSupportSectionService = async () => {
  let data = await MsmeSupportSection.findOne();
  if (!data) {
    data = await MsmeSupportSection.create({});
  }
  return data;
};

export const updateMsmeSupportSectionService = async (payload: any) => {
  const data = await MsmeSupportSection.findOneAndUpdate({}, payload, { new: true, upsert: true });
  return data;
};
