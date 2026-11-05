import HomeHero from "../../../../models/home/homeHero.model";
import { ApiError } from "../../../../utils/ApiError";
import mongoose from "mongoose";
import { isSlideActive, validateSlideSchedule } from "./homeHero.schedule";

// Schedule parsing / activity check live in homeHero.schedule.ts (IST-based, unit-tested).
export { isSlideActive };

export const createHomeHeroService = async (payload: any, file?: Express.Multer.File) => {
  const updateData = { ...payload };
  if (file) {
    updateData.img = `${file.filename}`;
  }
  return await HomeHero.create(updateData);
};

export const getAllHomeHeroService = async (options?: { all?: boolean }) => {
  // _id is the tie-breaker: slides saved in one batch can share the same createdAt millisecond.
  const slides = await HomeHero.find().sort({ createdAt: 1, _id: 1 });
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
    return await HomeHero.find().sort({ createdAt: 1, _id: 1 });
  }

  const cleanedSlides = slides.map((s: any) => ({
    // Pre-generated ids ascend in slide order, so order survives the createdAt/_id sort.
    _id: new mongoose.Types.ObjectId(),
    tagline: s.tagline || "",
    titlePrimary: s.titlePrimary || "",
    titleSecondary: s.titleSecondary || "",
    subtitle: s.subtitle || "",
    title: s.title || `${s.titlePrimary || ""} ${s.titleSecondary || ""}`.trim(),
    description: s.description || "",
    isScheduled: Boolean(s.isScheduled),
    showContent: s.showContent !== false,
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

  // Validate everything before touching the database.
  cleanedSlides.forEach((slide: any, index: number) => {
    const problem = validateSlideSchedule(slide);
    if (problem) throw ApiError.badRequest(`Hero Slide ${index + 1}: ${problem}`);
  });

  // Replace safely: insert the new slides first, delete the old ones only afterwards.
  // (Previously everything was deleted first, so a failed insert wiped all banners.)
  const previous = await HomeHero.find().select("_id").lean();
  const insertedIds = cleanedSlides.map((slide: any) => slide._id);

  let saved;
  try {
    saved = await HomeHero.insertMany(cleanedSlides);
  } catch (err) {
    await HomeHero.deleteMany({ _id: { $in: insertedIds } }).catch(() => undefined);
    throw err;
  }

  try {
    await HomeHero.deleteMany({ _id: { $in: previous.map((doc) => doc._id) } });
  } catch (err) {
    await HomeHero.deleteMany({ _id: { $in: insertedIds } }).catch(() => undefined);
    throw err;
  }

  return saved;
};
