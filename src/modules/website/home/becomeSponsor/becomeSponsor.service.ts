import BecomeSponsor from "../../../../models/home/becomeSponsor.model";

export const getBecomeSponsorService = async () => {
  let data = await BecomeSponsor.findOne();
  if (!data) {
    data = await BecomeSponsor.create({});
  }
  return data;
};

export const updateBecomeSponsorService = async (payload: any, files?: any) => {
  let updateData = { ...payload };

  if (typeof updateData.leftSection === "string") {
    try {
      updateData.leftSection = JSON.parse(updateData.leftSection);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.centerSection === "string") {
    try {
      updateData.centerSection = JSON.parse(updateData.centerSection);
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

  // Handle uploaded centerSection image if provided
  if (files && files.image && files.image[0]) {
    if (!updateData.centerSection) updateData.centerSection = {};
    updateData.centerSection.image = `/uploads/organic_expo/${files.image[0].filename}`;
  }

  const data = await BecomeSponsor.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
