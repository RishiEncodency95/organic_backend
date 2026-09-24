import GalleryItem from "../../../models/gallery/galleryItem.model";
import GalleryMeta from "../../../models/gallery/galleryMeta.model";

export const DEFAULT_GALLERY_CATEGORIES: string[] = [
  "Inauguration",
  "Scientific Sessions",
  "Panel Discussions",
  "Speakers",
  "Workshops",
  "Exhibition (Expo)",
  "Cultural Programs",
  "Awards",
  "Networking",
];

export const DEFAULT_GALLERY_YEARS: string[] = [
  "2026",
  "2025",
  "2024",
  "2023",
  "2022",
  "2021",
  "2020",
];

export const DEFAULT_GALLERY_ITEMS = [
  {
    order: 1,
    title: "Grand Inaugural Ceremony",
    year: "2025",
    category: "Inauguration",
    uploadedBy: "Vansh Chaudhary",
    date: "12 Sept 2026",
    time: "10:30 AM",
    status: "Published",
    image: "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=600&q=80",
    size: "245 KB",
  },
  {
    order: 2,
    title: "Keynote Address by Industry Leaders",
    year: "2025",
    category: "Scientific Sessions",
    uploadedBy: "Vansh Chaudhary",
    date: "12 Sept 2026",
    time: "04:15 PM",
    status: "Published",
    image: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=80",
    size: "189 KB",
  },
  {
    order: 3,
    title: "Global Organic Trade Panel Discussion",
    year: "2024",
    category: "Panel Discussions",
    uploadedBy: "Seva Team",
    date: "11 Sept 2026",
    time: "02:20 PM",
    status: "Published",
    image: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=600&q=80",
    size: "312 KB",
  },
  {
    order: 4,
    title: "Distinguished Guest Speakers Felicitation",
    year: "2024",
    category: "Speakers",
    uploadedBy: "Vansh Chaudhary",
    date: "10 Sept 2026",
    time: "11:45 AM",
    status: "Published",
    image: "https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=600&q=80",
    size: "157 KB",
  },
  {
    order: 5,
    title: "Organic Farming Interactive Workshop",
    year: "2023",
    category: "Workshops",
    uploadedBy: "Vansh Chaudhary",
    date: "09 Sept 2026",
    time: "01:05 PM",
    status: "Published",
    image: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&w=600&q=80",
    size: "198 KB",
  },
  {
    order: 6,
    title: "Exhibition Expo Main Arena & Stalls",
    year: "2023",
    category: "Exhibition (Expo)",
    uploadedBy: "Seva Team",
    date: "08 Sept 2026",
    time: "05:30 PM",
    status: "Published",
    image: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=600&q=80",
    size: "275 KB",
  },
  {
    order: 7,
    title: "Cultural Evening Celebration",
    year: "2022",
    category: "Cultural Programs",
    uploadedBy: "Vansh Chaudhary",
    date: "07 Sept 2026",
    time: "09:10 AM",
    status: "Draft",
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80",
    size: "340 KB",
  },
  {
    order: 8,
    title: "National Organic Leadership Awards",
    year: "2022",
    category: "Awards",
    uploadedBy: "Vansh Chaudhary",
    date: "06 Sept 2026",
    time: "12:00 PM",
    status: "Published",
    image: "https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?auto=format&fit=crop&w=600&q=80",
    size: "210 KB",
  },
  {
    order: 9,
    title: "B2B Buyer-Seller Networking Lounge",
    year: "2021",
    category: "Networking",
    uploadedBy: "Admin User",
    date: "05 Sept 2026",
    time: "03:40 PM",
    status: "Published",
    image: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=600&q=80",
    size: "185 KB",
  },
  {
    order: 10,
    title: "Delegates Meet & Opening Ceremony",
    year: "2020",
    category: "Inauguration",
    uploadedBy: "Vansh Chaudhary",
    date: "04 Sept 2026",
    time: "11:15 AM",
    status: "Published",
    image: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=600&q=80",
    size: "260 KB",
  },
];

export const getGalleryItems = async () => {
  return GalleryItem.find().sort({ order: 1, createdAt: -1 });
};

export const createGalleryItem = async (data: any) => {
  if (!data.order) {
    const highest = await GalleryItem.findOne().sort({ order: -1 });
    data.order = highest && highest.order ? highest.order + 1 : 1;
  }
  if (!data.title || data.title.trim() === "") {
    data.title = data.category || "Photo Asset";
  }
  const item = new GalleryItem(data);
  return item.save();
};

export const updateGalleryItem = async (id: string, data: any) => {
  if (!data.title || data.title.trim() === "") {
    data.title = data.category || "Photo Asset";
  }
  return GalleryItem.findByIdAndUpdate(id, { $set: data }, { new: true });
};

export const updateGalleryItemStatus = async (id: string, status: "Published" | "Draft") => {
  return GalleryItem.findByIdAndUpdate(id, { $set: { status } }, { new: true });
};

export const deleteGalleryItem = async (id: string) => {
  return GalleryItem.findByIdAndDelete(id);
};

export const bulkDeleteGalleryItems = async (ids: string[]) => {
  const result = await GalleryItem.deleteMany({ _id: { $in: ids } });
  return result.deletedCount ?? 0;
};

export const getGalleryMeta = async () => {
  let meta = await GalleryMeta.findOne({ key: "default_gallery_config" });
  if (!meta) {
    meta = await GalleryMeta.create({
      key: "default_gallery_config",
      categories: DEFAULT_GALLERY_CATEGORIES,
      years: DEFAULT_GALLERY_YEARS,
    });
  }
  return {
    categories: meta.categories && meta.categories.length > 0 ? meta.categories : DEFAULT_GALLERY_CATEGORIES,
    years: meta.years && meta.years.length > 0 ? meta.years : DEFAULT_GALLERY_YEARS,
  };
};

export const saveGalleryMeta = async (categories?: string[], years?: string[]) => {
  const updateData: any = {};
  if (Array.isArray(categories)) updateData.categories = categories;
  if (Array.isArray(years)) updateData.years = years;

  const meta = await GalleryMeta.findOneAndUpdate(
    { key: "default_gallery_config" },
    { $set: updateData },
    { new: true, upsert: true }
  );

  return {
    categories: meta.categories,
    years: meta.years,
  };
};
