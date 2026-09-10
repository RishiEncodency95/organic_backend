import TestimonialsCarousel from "../../../../models/home/testimonialsCarousel.model";

export const getTestimonialsCarouselService = async () => {
  let data = await TestimonialsCarousel.findOne();
  if (!data) {
    data = await TestimonialsCarousel.create({});
  }
  return data;
};

export const updateTestimonialsCarouselService = async (payload: any) => {
  let updateData = { ...payload };

  if (typeof updateData.testimonials === "string") {
    try {
      updateData.testimonials = JSON.parse(updateData.testimonials);
    } catch {
      // keep as is
    }
  }

  const data = await TestimonialsCarousel.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};
