import WhyExhibitTestimonials from "../../../../../models/participate/why_exhibit/whyExhibitTestimonials.model";

export const getWhyExhibitTestimonialsService = async () => {
  let data = await WhyExhibitTestimonials.findOne();
  if (!data) {
    data = await WhyExhibitTestimonials.create({ testimonials: [] });
  }
  return data;
};

export const updateWhyExhibitTestimonialsService = async (payload: any) => {
  let testimonials = payload?.testimonials;

  if (typeof testimonials === "string") {
    try {
      testimonials = JSON.parse(testimonials);
    } catch {
      // keep as is
    }
  }

  const data = await WhyExhibitTestimonials.findOneAndUpdate(
    {},
    { testimonials: Array.isArray(testimonials) ? testimonials : [] },
    { new: true, upsert: true }
  );
  return data;
};
