import { Request, Response } from "express";
import Settings from "../../models/settings.model";

const defaultFooter = {
  key: "footer",
  name: "Footer & Social Links",
  enabled: true,
  description:
    "A global platform uniting over 500+ exhibitors from across the organic value chain, showcasing certified products, advanced agritech, sustainable practices, and the rich heritage of traditional wellness. Discover organic living with conferences and B2B opportunities.",
  logoImage: "http://localhost:4000/uploads/bharat-organic_footer/1789129240083-112323989.png",
  leafImage: "http://localhost:4000/uploads/bharat-organic_footer/1789129240457-21656484.png",
  downImage: "http://localhost:4000/uploads/bharat-organic_footer/1789129240816-597711504.png",
  organisedByLogo: "http://localhost:4000/uploads/bharat-organic_footer/1789129241128-849314126.png",
  bottomBannerImage: "http://localhost:4000/uploads/bharat-organic_footer/1789129242465-452827954.webp",
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
