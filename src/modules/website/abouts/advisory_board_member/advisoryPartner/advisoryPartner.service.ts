import AdvisoryPartner from "../../../../../models/advisory_board_member/advisoryPartner.model";

export const getAdvisoryPartnerService = async () => {
  let data = await AdvisoryPartner.findOne();
  if (!data) {
    data = await AdvisoryPartner.create({});
  }
  return data;
};

export const updateAdvisoryPartnerService = async (payload: any) => {
  let data = await AdvisoryPartner.findOne();
  if (!data) {
    data = await AdvisoryPartner.create(payload);
  } else {
    data = await AdvisoryPartner.findByIdAndUpdate(data._id, payload, { new: true });
  }
  return data;
};
