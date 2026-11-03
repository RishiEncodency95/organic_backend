import HomeHero from "../../../../models/home/homeHero.model";
import { ApiError } from "../../../../utils/ApiError";

export const isSlideActive = (slide: any): boolean => {
  // If schedule is not enabled, the slide is always active
  if (!slide.isScheduled) {
    return true;
  }

  const now = Date.now();

  // 1. Check Start Date & Time
  if (slide.startDate && typeof slide.startDate === "string" && slide.startDate.trim()) {
    const sDate = slide.startDate.trim();
    const parts = sDate.split("-");
    if (parts.length === 3) {
      let hours = 0;
      let minutes = 0;
      if (slide.startTime && typeof slide.startTime === "string" && slide.startTime.trim()) {
        const timeParts = slide.startTime.trim().split(":");
        if (timeParts.length >= 2) {
          hours = Number(timeParts[0]) || 0;
          minutes = Number(timeParts[1]) || 0;
        }
      }
      const startTimeMs = new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2]),
        hours,
        minutes,
        0,
        0
      ).getTime();

      if (now < startTimeMs) {
        return false; // not started yet
      }
    }
  }

  // 2. Check End Date & Time
  const endDateStr = (slide.endDate || "").trim();
  if (endDateStr) {
    const parts = endDateStr.split("-");
    if (parts.length === 3) {
      let hours = 23;
      let minutes = 59;
      let seconds = 59;
      let ms = 999;
      if (slide.endTime && typeof slide.endTime === "string" && slide.endTime.trim()) {
        const timeParts = slide.endTime.trim().split(":");
        if (timeParts.length >= 2) {
          hours = Number(timeParts[0]) || 0;
          minutes = Number(timeParts[1]) || 0;
          seconds = 0;
          ms = 0;
        }
      }
      const endTimeMs = new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2]),
        hours,
        minutes,
        seconds,
        ms
      ).getTime();

      if (now > endTimeMs) {
        return false; // expired
      }
    }
  }

  return true;
};

export const createHomeHeroService = async (payload: any, file?: Express.Multer.File) => {
  const updateData = { ...payload };
  if (file) {
    updateData.img = `${file.filename}`;
  }
  return await HomeHero.create(updateData);
};

export const getAllHomeHeroService = async (options?: { all?: boolean }) => {
  const slides = await HomeHero.find().sort({ createdAt: 1 });
  if (options?.all) {
    return slides;
  }
  return slides.filter(isSlideActive);
};

export const getHomeHeroByIdService = async (id: string) => {
  const data = await HomeHero.findById(id);
  if (!data) throw ApiError.notFound("Home Hero banner not found");
  return data;
};

export const updateHomeHeroByIdService = async (id: string, payload: any, file?: Express.Multer.File) => {
  const updateData = { ...payload };
  if (file) {
    updateData.img = `${file.filename}`;
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
    isScheduled: Boolean(s.isScheduled),
    startDate: s.startDate || "",
    startTime: s.startTime || "",
    endDate: s.endDate || "",
    endTime: s.endTime || "",
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
