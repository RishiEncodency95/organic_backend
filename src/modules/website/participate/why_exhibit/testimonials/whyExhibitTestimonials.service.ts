import WhyExhibitTestimonials from "../../../../../models/participate/why_exhibit/whyExhibitTestimonials.model";
import { ApiError } from "../../../../../utils/ApiError";

const defaultTestimonials = [
  {
    companyName1: "Green Earth Organics Pvt. Ltd.",
    companyName2: "Organic Food & Agri",
    location: "Mumbai, India",
    quote: "Bharat Organic Expo gave us direct access to 500+ qualified buyers in just 3 days. We signed 12 new distribution agreements and expanded our reach to Southeast Asia. A must-attend event for any organic food brand!",
    initials: "GE",
    color: "#1b5e20",
  },
  {
    companyName1: "NatureFarm Exports",
    companyName2: "Agriculture & Exports",
    location: "Pune, India",
    quote: "The B2B matchmaking sessions were incredibly productive. We met international importers we would never have connected with otherwise. Our export revenue grew 40% after the expo.",
    initials: "NF",
    color: "#4B1426",
  },
  {
    companyName1: "Herbal Heritage India",
    companyName2: "Ayush & Herbal Products",
    location: "Delhi, India",
    quote: "Outstanding platform for herbal and wellness brands. The quality of visitors and their genuine interest in organic products made every conversation meaningful. Already registered for next year!",
    initials: "HH",
    color: "#0e3b1c",
  },
];

export const getAllWhyExhibitTestimonialsService = async () => {
  let list = await WhyExhibitTestimonials.find();
  if (list.length === 0) {
    list = await WhyExhibitTestimonials.insertMany(defaultTestimonials);
  }
  return list;
};

export const createWhyExhibitTestimonialsService = async (payload: any) => {
  return await WhyExhibitTestimonials.create(payload);
};

export const getWhyExhibitTestimonialsByIdService = async (id: string) => {
  const data = await WhyExhibitTestimonials.findById(id);
  if (!data) throw ApiError.notFound("Testimonial not found");
  return data;
};

export const updateWhyExhibitTestimonialsByIdService = async (id: string, payload: any) => {
  const data = await WhyExhibitTestimonials.findByIdAndUpdate(id, payload, { new: true });
  if (!data) throw ApiError.notFound("Testimonial not found");
  return data;
};

export const deleteWhyExhibitTestimonialsByIdService = async (id: string) => {
  const data = await WhyExhibitTestimonials.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Testimonial not found");
  return data;
};
