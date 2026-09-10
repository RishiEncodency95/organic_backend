import WhyJoinAdvisory from "../../../../../models/advisory_board_member/whyJoinAdvisory.model";

export const getWhyJoinAdvisoryService = async () => {
  let data = await WhyJoinAdvisory.findOne();
  if (!data) {
    data = await WhyJoinAdvisory.create({});
  }
  return data;
};

export const updateWhyJoinAdvisoryService = async (payload: any) => {
  let data = await WhyJoinAdvisory.findOne();
  if (!data) {
    data = await WhyJoinAdvisory.create(payload);
  } else {
    data = await WhyJoinAdvisory.findByIdAndUpdate(data._id, payload, { new: true });
  }
  return data;
};
