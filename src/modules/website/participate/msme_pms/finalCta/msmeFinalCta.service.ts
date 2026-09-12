import MsmeFinalCta from "../../../../../models/participate/msme_pms/msmeFinalCta.model";

export const getMsmeFinalCtaService = async () => {
  let data = await MsmeFinalCta.findOne();
  if (!data) {
    data = await MsmeFinalCta.create({});
  }
  return data;
};

export const updateMsmeFinalCtaService = async (payload: any) => {
  const data = await MsmeFinalCta.findOneAndUpdate({}, payload, { new: true, upsert: true });
  return data;
};
