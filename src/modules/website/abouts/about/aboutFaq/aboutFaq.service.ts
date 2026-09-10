import AboutFaq from "../../../../../models/about/aboutFaq.model";

export const getAboutFaqService = async () => {
  let data = await AboutFaq.findOne();
  if (!data) {
    data = await AboutFaq.create({});
  }
  return data;
};

export const updateAboutFaqService = async (payload: any) => {
  let updateData = { ...payload };

  if (typeof updateData.faqs === "string") {
    try {
      updateData.faqs = JSON.parse(updateData.faqs);
    } catch {
      // keep as is
    }
  }

  const data = await AboutFaq.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
