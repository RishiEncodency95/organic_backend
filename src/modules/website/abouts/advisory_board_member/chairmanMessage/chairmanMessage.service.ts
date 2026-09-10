import ChairmanMessage from "../../../../../models/advisory_board_member/chairmanMessage.model";

export const getChairmanMessageService = async () => {
  let data = await ChairmanMessage.findOne();
  if (!data) {
    data = await ChairmanMessage.create({});
  }
  return data;
};

export const updateChairmanMessageService = async (payload: any) => {
  let updateData = { ...payload };

  if (typeof updateData.paragraphs === "string") {
    try {
      updateData.paragraphs = JSON.parse(updateData.paragraphs);
    } catch {
      // keep as is
    }
  }

  const data = await ChairmanMessage.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
