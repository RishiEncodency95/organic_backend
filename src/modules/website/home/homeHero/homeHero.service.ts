import HomeHero from "../../../../models/home/homeHero.model";
import { ApiError } from "../../../../utils/ApiError";

export const createHomeHeroService = async (payload: any, file?: Express.Multer.File) => {
  const updateData = { ...payload };
  if (file) {
    updateData.img = `/uploads/organic_expo/${file.filename}`;
  }
  return await HomeHero.create(updateData);
};

export const getAllHomeHeroService = async () => {
  return await HomeHero.find().sort({ createdAt: 1 });
};

export const getHomeHeroByIdService = async (id: string) => {
  const data = await HomeHero.findById(id);
  if (!data) throw ApiError.notFound("Home Hero banner not found");
  return data;
};

export const updateHomeHeroByIdService = async (id: string, payload: any, file?: Express.Multer.File) => {
  const updateData = { ...payload };
  if (file) {
    updateData.img = `/uploads/organic_expo/${file.filename}`;
  }
  const data = await HomeHero.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Home Hero banner not found");
  return data;
};

export const deleteHomeHeroByIdService = async (id: string) => {
  const data = await HomeHero.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Home Hero banner not found");
  return data;
};

export const syncHomeHeroSlidesService = async (slidesPayload: any) => {
  const slides = Array.isArray(slidesPayload)
    ? slidesPayload
    : Array.isArray(slidesPayload?.slides)
    ? slidesPayload.slides
    : [slidesPayload];

  if (!slides || slides.length === 0) {
    return await HomeHero.find().sort({ createdAt: 1 });
  }

  // Clear and replace with latest ordered slides
  await HomeHero.deleteMany({});
  const cleanedSlides = slides.map((s: any) => ({
    tagline: s.tagline || "",
    titlePrimary: s.titlePrimary || "",
    titleSecondary: s.titleSecondary || "",
    subtitle: s.subtitle || "",
    title: s.title || `${s.titlePrimary || ""} ${s.titleSecondary || ""}`.trim(),
    description: s.description || "",
    date: s.date || "",
    location: s.location || "",
    img: s.image || s.img || "",
    image: s.image || s.img || "",
    alt: s.alt || "",
    button1Name: s.buttonLabel || s.button1Name || "Book Your Stall",
    button1Link: s.buttonHref || s.button1Link || "/registration/book-a-stand",
    button2Name: s.secondaryButtonLabel || s.button2Name || "Register as Visitor",
    button2Link: s.secondaryButtonHref || s.button2Link || "/registration/visitor-registration",
    status: s.status || "active",
  }));

  const saved = await HomeHero.insertMany(cleanedSlides);
  return saved;
};
