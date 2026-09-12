import MsmeFinancialAssistance from "../../../../../models/participate/msme_pms/msmeFinancialAssistance.model";

export const getMsmeFinancialAssistanceService = async () => {
  let data = await MsmeFinancialAssistance.findOne();
  if (!data) {
    data = await MsmeFinancialAssistance.create({});
  }
  return data;
};

export const updateMsmeFinancialAssistanceService = async (payload: any) => {
  const data = await MsmeFinancialAssistance.findOneAndUpdate({}, payload, { new: true, upsert: true });
  return data;
};
