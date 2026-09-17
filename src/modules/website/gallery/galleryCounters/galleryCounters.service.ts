import GalleryCounters from "../../../../models/gallery/galleryCounters.model";
import Settings from "../../../../models/settings.model";

export const DEFAULT_GALLERY_COUNTERS = {
  enabled: true,
  title: "EXPO IMPACT IN NUMBERS",
  items: [
    { val: "200+", label: "Exhibitors", icon: "Building2", image: "" },
    { val: "8,000", label: "Visitors", icon: "Users", image: "" },
    { val: "50+", label: "Expert Speakers", icon: "Mic", image: "" },
    { val: "5,000+", label: "Delegates", icon: "UserCheck", image: "" },
    { val: "25+", label: "Countries Participated", icon: "Globe", image: "" },
    { val: "100+", label: "Sessions Conducted", icon: "Calendar", image: "" },
  ],
};

export const getGalleryCountersService = async () => {
  let data = await GalleryCounters.findOne();

  // If no document or empty items, check Settings collection
  if (!data || !data.items || data.items.length === 0) {
    try {
      const settingsDoc = await Settings.findOne({ website: "Organicexpo" });
      const sections = settingsDoc?.data?.galleryPage?.sections;
      if (Array.isArray(sections)) {
        const counters = sections.find((s: any) => s.key === "gallery-counters" || s.name === "Counters");
        if (counters && Array.isArray(counters.items) && counters.items.length > 0) {
          data = await GalleryCounters.findOneAndUpdate(
            {},
            {
              enabled: counters.enabled !== false,
              title: counters.title || DEFAULT_GALLERY_COUNTERS.title,
              items: counters.items.map((it: any) => ({
                val: it.val || it.number || it.count || "0",
                label: it.label || it.title || "",
                icon: it.icon || "Users",
                image: it.image || "",
              })),
            },
            { upsert: true, new: true }
          );
          return data;
        }
      }
    } catch (err) {
      console.error("Error reading gallery-counters from Settings:", err);
    }
  }

  if (!data) {
    data = await GalleryCounters.create(DEFAULT_GALLERY_COUNTERS);
  }
  return data;
};

export const updateGalleryCountersService = async (payload: any) => {
  const updateData: any = {};

  if (typeof payload.enabled === "boolean") updateData.enabled = payload.enabled;
  if (typeof payload.enabled === "string") updateData.enabled = payload.enabled === "true";

  if (payload.title !== undefined) updateData.title = payload.title;

  if (Array.isArray(payload.items)) {
    updateData.items = payload.items.map((it: any) => ({
      val: it.val ?? it.number ?? it.count ?? "",
      label: it.label ?? it.title ?? "",
      icon: it.icon ?? "Users",
      image: it.image ?? "",
    }));
  }

  const data = await GalleryCounters.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });

  // Also sync to Settings collection galleryPage.sections
  try {
    const settingsDoc = await Settings.findOne({ website: "Organicexpo" });
    if (settingsDoc?.data?.galleryPage?.sections) {
      const sections = settingsDoc.data.galleryPage.sections;
      const idx = sections.findIndex((s: any) => s.key === "gallery-counters" || s.name === "Counters");
      if (idx !== -1) {
        sections[idx] = {
          ...sections[idx],
          enabled: data.enabled,
          title: data.title,
          items: data.items.map((it: any) => ({
            val: it.val,
            label: it.label,
            icon: it.icon,
            image: it.image,
          })),
        };
        settingsDoc.markModified("data");
        await settingsDoc.save();
      }
    }
  } catch (err) {
    console.error("Failed syncing GalleryCounters to Settings doc:", err);
  }

  return data;
};
