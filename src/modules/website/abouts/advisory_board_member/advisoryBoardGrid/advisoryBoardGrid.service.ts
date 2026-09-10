import AdvisoryBoardGrid from "../../../../../models/advisory_board_member/advisoryBoardGrid.model";

export const getAdvisoryBoardGridService = async () => {
  let data = await AdvisoryBoardGrid.findOne();
  if (!data) {
    data = await AdvisoryBoardGrid.create({});
  }
  return data;
};

export const updateAdvisoryBoardGridService = async (payload: any) => {
  const data = await AdvisoryBoardGrid.findOneAndUpdate({}, payload, {
    new: true,
    upsert: true,
  });
  return data;
};
