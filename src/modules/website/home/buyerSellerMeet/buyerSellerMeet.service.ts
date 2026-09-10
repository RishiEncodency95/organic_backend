import BuyerSellerMeet from "../../../../models/home/buyerSellerMeet.model";

export const getBuyerSellerMeetService = async () => {
  let data = await BuyerSellerMeet.findOne();
  if (!data) {
    data = await BuyerSellerMeet.create({});
  }
  return data;
};

export const updateBuyerSellerMeetService = async (payload: any, files?: any) => {
  let updateData = { ...payload };

  if (typeof updateData.leftSection === "string") {
    try {
      updateData.leftSection = JSON.parse(updateData.leftSection);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.rightSection === "string") {
    try {
      updateData.rightSection = JSON.parse(updateData.rightSection);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.statsBar === "string") {
    try {
      updateData.statsBar = JSON.parse(updateData.statsBar);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.premiumBand === "string") {
    try {
      updateData.premiumBand = JSON.parse(updateData.premiumBand);
    } catch {
      // keep as is
    }
  }

  if (files && files.image && files.image[0]) {
    if (!updateData.rightSection) updateData.rightSection = {};
    updateData.rightSection.image = `/uploads/organic_expo/${files.image[0].filename}`;
  }

  const data = await BuyerSellerMeet.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
