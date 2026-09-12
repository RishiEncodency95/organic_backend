import Seo, { ISeo } from "../../models/seo.model";

const LOCAL_BASE_URL = "http://localhost:3002";
const LIVE_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bharatorganicexpo.com";

export function normalizePageKey(key: string): string {
  let cleaned = (key || "").toLowerCase().trim().replace(/^\/+|\/+$/g, "");
  if (!cleaned || cleaned === "home" || cleaned === "index") {
    return "home";
  }
  return cleaned;
}

export function getBaseUrl(envType?: string): string {
  if (envType === "local" || process.env.NODE_ENV !== "production") {
    return LOCAL_BASE_URL;
  }
  return LIVE_BASE_URL;
}

export function generateSeoDefaults(
  pageKey: string,
  envType: "local" | "live" = "local",
  customTitle?: string,
  customDesc?: string
) {
  const normKey = normalizePageKey(pageKey);
  const baseUrl = envType === "live" ? LIVE_BASE_URL : LOCAL_BASE_URL;
  const path = normKey === "home" ? "" : `/${normKey}`;
  const fullUrl = `${baseUrl}${path}`;

  const metaTitle =
    customTitle ||
    (normKey === "home"
      ? "Bharat Organic Expo 2027 – International Trade Fair on Organic Products"
      : `${normKey.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} | Bharat Organic Expo 2027`);

  const metaDescription =
    customDesc ||
    "Join Bharat Organic Expo 2027, the premier exhibition and conference for organic food, agriculture, and natural products in India.";

  const metaKeywords =
    "organic expo, bharat organic expo, organic farming, ayurveda, herbal products, natural wellness, sustainable agriculture";

  const canonicalUrl = fullUrl;
  const canonicalTag = `<link rel="canonical" href="${fullUrl}" />`;

  const ogImage = "https://res.cloudinary.com/dr8mld4i0/image/upload/v1788165233/moksha-sewa/assets/km.jpg";

  const openGraphTags = `<meta property="og:title" content="${metaTitle}" />
<meta property="og:description" content="${metaDescription}" />
<meta property="og:url" content="${fullUrl}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Bharat Organic Expo 2027" />
<meta property="og:image" content="${ogImage}" />`;

  const schemaMarkup = JSON.stringify(
    normKey === "home"
      ? {
          "@context": "https://schema.org",
          "@type": "Event",
          name: "Bharat Organic Expo 2027",
          description: metaDescription,
          url: fullUrl,
          startDate: "2027-02-19T09:00:00+05:30",
          endDate: "2027-02-21T18:00:00+05:30",
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          eventStatus: "https://schema.org/EventScheduled",
          location: {
            "@type": "Place",
            name: "Pragati Maidan",
            address: {
              "@type": "PostalAddress",
              addressLocality: "New Delhi",
              addressCountry: "IN",
            },
          },
          organizer: {
            "@type": "Organization",
            name: "Namo Gange Wellness Pvt. Ltd.",
            url: baseUrl,
          },
          image: [ogImage],
        }
      : {
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: metaTitle,
          description: metaDescription,
          url: fullUrl,
          publisher: {
            "@type": "Organization",
            name: "Bharat Organic Expo 2027",
            url: baseUrl,
          },
        },
    null,
    2
  );

  return {
    page: normKey,
    metaTitle,
    metaDescription,
    metaKeywords,
    canonicalUrl,
    canonicalTag,
    openGraphTags,
    schemaMarkup,
    ogTitle: metaTitle,
    ogDescription: metaDescription,
    ogImage,
    robotsIndex: true,
    robotsFollow: true,
    isActive: true,
    envType,
  };
}

export const seoService = {
  async getSeoByPage(pageKey: string, envType: "local" | "live" = "local") {
    const normKey = normalizePageKey(pageKey);
    const existing = await Seo.findOne({ page: normKey });

    if (existing) {
      const data = existing.toObject();
      const defaults = generateSeoDefaults(normKey, envType, data.metaTitle, data.metaDescription);

      let canonicalUrl = (data.canonicalUrl || "").trim();
      let canonicalTag = (data.canonicalTag || "").trim();

      if (!canonicalUrl && !canonicalTag) {
        canonicalUrl = defaults.canonicalUrl;
        canonicalTag = defaults.canonicalTag;
      } else if (!canonicalTag && canonicalUrl) {
        canonicalTag = `<link rel="canonical" href="${canonicalUrl}" />`;
      } else if (canonicalTag && !canonicalUrl) {
        const match = canonicalTag.match(/href=["']([^"']+)["']/i);
        canonicalUrl = match ? match[1] : canonicalTag.replace(/<[^>]*>/g, "").trim();
      }

      // Convert domain if standard domain and envType is specified
      if (envType === "local") {
        canonicalUrl = canonicalUrl.replace("https://bharatorganicexpo.com", LOCAL_BASE_URL);
        canonicalTag = canonicalTag.replace("https://bharatorganicexpo.com", LOCAL_BASE_URL);
      } else if (envType === "live") {
        canonicalUrl = canonicalUrl.replace(/http:\/\/(localhost|127\.0\.0\.1):3002/, LIVE_BASE_URL);
        canonicalTag = canonicalTag.replace(/http:\/\/(localhost|127\.0\.0\.1):3002/, LIVE_BASE_URL);
      }

      return {
        ...defaults,
        ...data,
        canonicalUrl: canonicalUrl || defaults.canonicalUrl,
        canonicalTag: canonicalTag || defaults.canonicalTag,
        openGraphTags: data.openGraphTags || defaults.openGraphTags,
        schemaMarkup: data.schemaMarkup || defaults.schemaMarkup,
      };
    }

    // Default fallback
    return generateSeoDefaults(normKey, envType);
  },

  async getAllSeo() {
    return Seo.find().sort({ updatedAt: -1 });
  },

  async upsertSeo(data: any) {
    const normKey = normalizePageKey(data.page || "home");
    const payload: Partial<ISeo> = {
      page: normKey,
      metaTitle: data.metaTitle || "",
      metaDescription: data.metaDescription || "",
      metaKeywords: data.metaKeywords || "",
      canonicalUrl: data.canonicalUrl || "",
      canonicalTag: data.canonicalTag || "",
      openGraphTags: data.openGraphTags || "",
      schemaMarkup: data.schemaMarkup || "",
      ogTitle: data.ogTitle || data.metaTitle || "",
      ogDescription: data.ogDescription || data.metaDescription || "",
      ogImage: data.ogImage || "",
      robotsIndex: data.robotsIndex !== false,
      robotsFollow: data.robotsFollow !== false,
      isActive: data.isActive !== false,
      updatedBy: data.updatedBy || "Admin User",
    };

    const updated = await Seo.findOneAndUpdate(
      { page: normKey },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return updated;
  },

  autoGenerate(pageKey: string, envType: "local" | "live", title?: string, desc?: string) {
    return generateSeoDefaults(pageKey, envType, title, desc);
  },
};
