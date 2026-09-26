import { Request, Response } from "express";
import Settings from "../../models/settings.model";
import GalleryHero from "../../models/gallery/galleryHero.model";
import GalleryCounters from "../../models/gallery/galleryCounters.model";

const defaultFooter = {
  key: "footer",
  name: "Footer & Social Links",
  enabled: true,
  description:
    "A global platform uniting over 500+ exhibitors from across the organic value chain, showcasing certified products, advanced agritech, sustainable practices, and the rich heritage of traditional wellness. Discover organic living with conferences and B2B opportunities.",
  // Left empty on purpose: these used to hardcode a local `/uploads/...` URL
  // from the server's disk, which every visitor's browser loaded directly —
  // the frontend's Footer component already falls back to its own bundled
  // placeholder art (no server round-trip at all) whenever these are empty.
  // Upload real logo/decoration images via Settings → Footer in the admin
  // panel to override these; they will be saved as Cloudinary URLs.
  logoImage: "",
  leafImage: "",
  downImage: "",
  organisedByLogo: "",
  bottomBannerImage: "",
  websiteUrl: "www.bharatorganicexpo.com",
  contactAddress: "Hall 12, Pragati Maidan, New Delhi, India 110001",
  phoneNumber: "+91 96549 00525",
  conferenceHelpline: "+91 98183 53841",
  contactEmail: "info@namogangewellness.com",
  facebookUrl: "https://facebook.com/bharatorganicexpo",
  twitterUrl: "https://twitter.com/bharatorganic",
  linkedinUrl: "https://linkedin.com/company/bharatorganicexpo",
  instagramUrl: "https://instagram.com/bharatorganicexpo",
  youtubeUrl: "https://youtube.com/@bharatorganicexpo",
  items: [
    { label: "Home", href: "/" },
    { label: "About Us", href: "/about" },
    { label: "Exhibitor Registration", href: "/registration/book-a-stand" },
    { label: "Delegate Registration", href: "https://arogya.namogange.org/" },
    { label: "Conference Tracks", href: "https://arogya.namogange.org/" },
    { label: "Buyer Seller Meet", href: "/buyer-seller-meet" },
    { label: "Exhibitor List", href: "/exhibitors" },
    { label: "Blogs", href: "/blog" },
    { label: "Awards", href: "/awards" },
    { label: "Contact Us", href: "/contact" },
  ],
};

export const getSettings = async (req: Request, res: Response) => {
  try {
    const website = (req.query.website as string) || "Organicexpo";
    let doc = await Settings.findOne({ website });

    if (!doc) {
      doc = await Settings.create({
        website,
        data: {
          websiteName: "Bharat Organic Expo 2027",
          landingPage: {
            sections: [defaultFooter],
          },
        },
      });
    } else {
      // Ensure footer section is present if landingPage.sections exists
      const currentData = doc.data || {};
      if (!currentData.landingPage) {
        currentData.landingPage = { sections: [defaultFooter] };
        doc.data = currentData;
        doc.markModified("data");
        await doc.save();
      } else if (Array.isArray(currentData.landingPage.sections)) {
        const hasFooter = currentData.landingPage.sections.some((s: any) => s.key === "footer");
        if (!hasFooter) {
          currentData.landingPage.sections.push(defaultFooter);
          doc.data = currentData;
          doc.markModified("data");
          await doc.save();
        }
      }
    }

    const payload = doc.data || {};
    return res.status(200).json({
      success: true,
      data: payload,
      ...payload,
    });
  } catch (err: any) {
    console.error("Error getting settings:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const website = (req.query.website as string) || req.body.website || "Organicexpo";
    const bodyPayload = { ...req.body };
    delete bodyPayload.website;

    let doc = await Settings.findOne({ website });
    let currentData = doc ? doc.data || {} : {};

    // Deep merge or overwrite incoming settings keys
    const mergedData = {
      ...currentData,
      ...bodyPayload,
    };

    if (bodyPayload.landingPage) {
      mergedData.landingPage = {
        ...(currentData.landingPage || {}),
        ...bodyPayload.landingPage,
      };
      if (Array.isArray(bodyPayload.landingPage.sections)) {
        mergedData.landingPage.sections = bodyPayload.landingPage.sections;
      }
    }

    if (bodyPayload.galleryPage) {
      mergedData.galleryPage = {
        ...(currentData.galleryPage || {}),
        ...bodyPayload.galleryPage,
      };
      if (Array.isArray(bodyPayload.galleryPage.sections)) {
        mergedData.galleryPage.sections = bodyPayload.galleryPage.sections;
        const hero = bodyPayload.galleryPage.sections.find(
          (s: any) => s.key === "gallery-hero" || s.name === "HeroSection"
        );
        if (hero) {
          try {
            await GalleryHero.findOneAndUpdate(
              {},
              {
                enabled: hero.enabled !== false,
                title: hero.title || "GLIMPSES",
                subtitle: hero.subtitle || "",
                shortDescription: hero.shortDescription || hero.description || "",
                rightImage: hero.rightImage || hero.image || "",
              },
              { upsert: true, new: true }
            );
          } catch (e) {
            console.error("Failed to sync GalleryHero from settings:", e);
          }
        }

        const counters = bodyPayload.galleryPage.sections.find(
          (s: any) => s.key === "gallery-counters" || s.name === "Counters"
        );
        if (counters && Array.isArray(counters.items)) {
          try {
            await GalleryCounters.findOneAndUpdate(
              {},
              {
                enabled: counters.enabled !== false,
                title: counters.title || "EXPO IMPACT IN NUMBERS",
                items: counters.items.map((it: any) => ({
                  val: it.val ?? it.number ?? it.count ?? "",
                  label: it.label ?? it.title ?? "",
                  icon: it.icon ?? "Users",
                  image: it.image ?? "",
                })),
              },
              { upsert: true, new: true }
            );
          } catch (e) {
            console.error("Failed to sync GalleryCounters from settings:", e);
          }
        }
      }
    }

    if (!doc) {
      doc = await Settings.create({
        website,
        data: mergedData,
      });
    } else {
      doc.data = mergedData;
      doc.markModified("data");
      await doc.save();
    }

    return res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      data: doc.data,
      ...doc.data,
    });
  } catch (err: any) {
    console.error("Error updating settings:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update settings",
      error: err.message,
    });
  }
};
