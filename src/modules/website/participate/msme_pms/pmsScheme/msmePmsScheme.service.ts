import MsmePmsScheme from "../../../../../models/participate/msme_pms/msmePmsScheme.model";

export const getMsmePmsSchemeService = async () => {
  let data = await MsmePmsScheme.findOne();
  if (!data) {
    data = await MsmePmsScheme.create({});
  }
  return data;
};

export const updateMsmePmsSchemeService = async (payload: any) => {
  const data = await MsmePmsScheme.findOneAndUpdate({}, payload, { new: true, upsert: true });
  return data;
};
