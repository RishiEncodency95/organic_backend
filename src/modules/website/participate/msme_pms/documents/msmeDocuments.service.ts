import MsmeDocuments from "../../../../../models/participate/msme_pms/msmeDocuments.model";

export const getMsmeDocumentsService = async () => {
  let data = await MsmeDocuments.findOne();
  if (!data) {
    data = await MsmeDocuments.create({});
  }
  return data;
};

export const updateMsmeDocumentsService = async (payload: any) => {
  const data = await MsmeDocuments.findOneAndUpdate({}, payload, { new: true, upsert: true });
  return data;
};
