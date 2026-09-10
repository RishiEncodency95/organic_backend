import IntroductionSection from "../../../../models/home/introductionSection.model";

export const getIntroductionSectionService = async () => {
  let data = await IntroductionSection.findOne();
  if (!data) {
    data = await IntroductionSection.create({});
  }
  return data;
};

export const updateIntroductionSectionService = async (payload: any, files?: any) => {
  let updateData = { ...payload };

  if (typeof updateData.title === "string") {
    try {
      updateData.title = JSON.parse(updateData.title);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.paragraphs === "string") {
    try {
      updateData.paragraphs = JSON.parse(updateData.paragraphs);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.button === "string") {
    try {
      updateData.button = JSON.parse(updateData.button);
    } catch {
      // keep as is
    }
  }

  if (files && files.image && files.image[0]) {
    updateData.image = `/uploads/organic_expo/${files.image[0].filename}`;
  }

  const data = await IntroductionSection.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
