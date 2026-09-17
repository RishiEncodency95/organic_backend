import GalleryHero from "../../../../models/gallery/galleryHero.model";
import Settings from "../../../../models/settings.model";

const DEFAULT_GALLERY_HERO = {
  enabled: true,
  title: "GLIMPSES",
  subtitle: "Moments of Knowledge, Collaboration & Wellness",
  shortDescription:
    "Relive the inspiring moments from past editions of Organic Expo where experts, researchers and industry leaders came together to shape the future of organic trade and sustainable living.",
  rightImage:
    "https://res.cloudinary.com/dr8mld4i0/image/upload/v1788165233/moksha-sewa/assets/km.jpg",
};

export const getGalleryHeroService = async () => {
  let data = await GalleryHero.findOne();

  // If no data or still matching the original default, check if Settings has user-edited content
  if (!data || data.title === DEFAULT_GALLERY_HERO.title) {
    try {
      const settingsDoc = await Settings.findOne({ website: "Organicexpo" });
      const sections = settingsDoc?.data?.galleryPage?.sections;
      if (Array.isArray(sections)) {
        const hero = sections.find((s: any) => s.key === "gallery-hero" || s.name === "HeroSection");
        if (hero && (hero.title || hero.image || hero.rightImage)) {
          data = await GalleryHero.findOneAndUpdate(
            {},
            {
              enabled: hero.enabled !== false,
              title: hero.title || DEFAULT_GALLERY_HERO.title,
              subtitle: hero.subtitle || DEFAULT_GALLERY_HERO.subtitle,
              shortDescription: hero.shortDescription || hero.description || DEFAULT_GALLERY_HERO.shortDescription,
              rightImage: hero.rightImage || hero.image || DEFAULT_GALLERY_HERO.rightImage,
            },
            { upsert: true, new: true }
          );
          return data;
        }
      }
    } catch (err) {
      console.error("Error reading galleryPage from Settings:", err);
    }
  }

  if (!data) {
    data = await GalleryHero.create(DEFAULT_GALLERY_HERO);
  }
  return data;
};

export const updateGalleryHeroService = async (payload: any) => {
  const updateData: any = {};

  if (typeof payload.enabled === "boolean") updateData.enabled = payload.enabled;
  if (typeof payload.enabled === "string") updateData.enabled = payload.enabled === "true";

  if (payload.title !== undefined) updateData.title = payload.title;
  if (payload.subtitle !== undefined) updateData.subtitle = payload.subtitle;

  // Support both shortDescription and description as aliases
  if (payload.shortDescription !== undefined) updateData.shortDescription = payload.shortDescription;
  if (payload.description !== undefined) updateData.shortDescription = payload.description;

  // Support rightImage and image as aliases
  if (payload.rightImage !== undefined) updateData.rightImage = payload.rightImage;
  if (payload.image !== undefined) updateData.rightImage = payload.image;

  const data = await GalleryHero.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });

  // Also keep Settings collection galleryPage.sections in sync
  try {
    const settingsDoc = await Settings.findOne({ website: "Organicexpo" });
    if (settingsDoc?.data?.galleryPage?.sections) {
      const sections = settingsDoc.data.galleryPage.sections;
      const idx = sections.findIndex((s: any) => s.key === "gallery-hero" || s.name === "HeroSection");
      if (idx !== -1) {
        sections[idx] = {
          ...sections[idx],
          enabled: data.enabled,
          title: data.title,
          subtitle: data.subtitle,
          description: data.shortDescription,
          image: data.rightImage,
        };
        delete sections[idx].shortDescription;
        delete sections[idx].rightImage;
        settingsDoc.markModified("data");
        await settingsDoc.save();
      }
    }
  } catch (err) {
    console.error("Failed syncing GalleryHero to Settings doc:", err);
  }

  return data;
};
