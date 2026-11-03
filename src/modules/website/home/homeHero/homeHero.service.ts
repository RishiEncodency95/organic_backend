import HomeHero from "../../../../models/home/homeHero.model";
import { ApiError } from "../../../../utils/ApiError";

const parseDateTime = (dateStr?: string, timeStr?: string, isEnd = false): number | null => {
  if (!dateStr || typeof dateStr !== "string" || !dateStr.trim()) return null;
  const parts = dateStr.trim().split("-");
  if (parts.length !== 3) return null;

  let year: number;
  let month: number;
  let day: number;

  if (parts[0].length === 4) {
    year = Number(parts[0]);
    month = Number(parts[1]) - 1;
    day = Number(parts[2]);
  } else if (parts[2].length === 4) {
    day = Number(parts[0]);
    month = Number(parts[1]) - 1;
    year = Number(parts[2]);
  } else {
    return null;
  }

  let hours = isEnd ? 23 : 0;
  let minutes = isEnd ? 59 : 0;
  let seconds = isEnd ? 59 : 0;
  let ms = isEnd ? 999 : 0;

  if (timeStr && typeof timeStr === "string" && timeStr.trim()) {
    const timeParts = timeStr.trim().split(":");
    if (timeParts.length >= 2) {
      hours = Number(timeParts[0]) || 0;
      minutes = Number(timeParts[1]) || 0;
      seconds = 0;
      ms = 0;
    }
  }

  return new Date(year, month, day, hours, minutes, seconds, ms).getTime();
};

export const isSlideActive = (slide: any): boolean => {
  // If schedule is not enabled, the slide is always active
  if (!slide.isScheduled) {
    return true;
  }

  const now = Date.now();

  const startMs = parseDateTime(slide.startDate, slide.startTime, false);
  if (startMs !== null && now < startMs) {
    return false; // not started yet
  }

  const endMs = parseDateTime(slide.endDate, slide.endTime, true);
  if (endMs !== null && now > endMs) {
    return false; // expired
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
