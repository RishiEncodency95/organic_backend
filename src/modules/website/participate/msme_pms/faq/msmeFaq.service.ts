import MsmeFaq from "../../../../../models/participate/msme_pms/msmeFaq.model";

export const getMsmeFaqService = async () => {
  let data = await MsmeFaq.findOne();
  if (!data) {
    data = await MsmeFaq.create({});
  }
  return data;
};

export const updateMsmeFaqService = async (payload: any) => {
  const data = await MsmeFaq.findOneAndUpdate({}, payload, { new: true, upsert: true });
  return data;
};
