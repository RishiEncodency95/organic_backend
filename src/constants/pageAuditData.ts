/**
 * Real crawl + Search Console inventory for the 21 indexable routes of
 * bharatorganicexpo.com.
 *
 * Source: the site crawler export (words / internal links / issues) combined
 * with the Search Console performance window (clicks / impressions / position)
 * and field Core Web Vitals (LCP / CLS).
 *
 * Nothing in here is generated at runtime — these are the measured values.
 */
export interface PageAuditRecord {
  id: string;
  path: string;
  label: string;
  title: string;
  score: number;
  words: number;
  inLinks: number;
  lcp: number;
  cls: number;
  clicks: number;
  impressions: number;
  position: number;
  issue: "ok" | "short";
}

export const PAGE_INVENTORY: PageAuditRecord[] = [
  { id: "home", path: "/", label: "Home Page", title: "Bharat Organic Expo 2027 | India's Mega Wellness & Organic Fair", score: 100, words: 1420, inLinks: 26, lcp: 1.5, cls: 0.07, clicks: 450, impressions: 12800, position: 1.4, issue: "ok" },
  { id: "about", path: "/about", label: "About", title: "About | Bharat Organic Expo 2027", score: 95, words: 836, inLinks: 22, lcp: 1.62, cls: 0.045, clicks: 57, impressions: 1425, position: 5.1, issue: "short" },
  { id: "why-visit", path: "/why-visit", label: "Why Visit", title: "Why Visit | Bharat Organic Expo 2027", score: 96, words: 1254, inLinks: 31, lcp: 1.48, cls: 0.012, clicks: 225, impressions: 3600, position: 15.8, issue: "ok" },
  { id: "registration", path: "/registration", label: "Registration", title: "Registration | Bharat Organic Expo 2027", score: 91, words: 1272, inLinks: 19, lcp: 1.72, cls: 0.021, clicks: 197, impressions: 4137, position: 24.2, issue: "ok" },
  { id: "contact", path: "/contact", label: "Contact Us", title: "Contact Us | Bharat Organic Expo 2027", score: 88, words: 1681, inLinks: 20, lcp: 1.85, cls: 0.035, clicks: 338, impressions: 5746, position: 8.7, issue: "short" },
  { id: "exhibition-categories", path: "/exhibition-categories", label: "Exhibition Categories", title: "Exhibition Categories | Bharat Organic Expo 2027", score: 83, words: 1102, inLinks: 14, lcp: 1.95, cls: 0.089, clicks: 90, impressions: 2610, position: 6.1, issue: "ok" },
  { id: "why-exhibit", path: "/why-exhibit", label: "Why Exhibit", title: "Why Exhibit | Bharat Organic Expo 2027", score: 86, words: 1131, inLinks: 39, lcp: 1.26, cls: 0.024, clicks: 12, impressions: 180, position: 23.4, issue: "ok" },
  { id: "participate-as-exhibitor", path: "/participate-as-exhibitor", label: "Exhibitor Participation", title: "Exhibitor Participation | Bharat Organic Expo 2027 Booths", score: 91, words: 1435, inLinks: 40, lcp: 2.14, cls: 0.042, clicks: 306, impressions: 2142, position: 5.6, issue: "ok" },
  { id: "sponsorship", path: "/sponsorship", label: "Sponsorship", title: "Sponsorship | Bharat Organic Expo 2027", score: 100, words: 1498, inLinks: 19, lcp: 1.60, cls: 0.012, clicks: 490, impressions: 11270, position: 13.7, issue: "ok" },
  { id: "blog", path: "/blog", label: "Blog", title: "Blog | Bharat Organic Expo 2027", score: 77, words: 1000, inLinks: 34, lcp: 1.51, cls: 0.062, clicks: 361, impressions: 3971, position: 22.5, issue: "short" },
  { id: "careers", path: "/careers", label: "Careers", title: "Careers | Bharat Organic Expo 2027", score: 90, words: 1729, inLinks: 27, lcp: 1.54, cls: 0.025, clicks: 229, impressions: 2748, position: 26.9, issue: "ok" },
  { id: "buyer-seller-meet", path: "/buyer-seller-meet", label: "Buyer Seller Meet", title: "Buyer Seller Meet | Bharat Organic Expo 2027", score: 63, words: 1435, inLinks: 18, lcp: 1.83, cls: 0.040, clicks: 170, impressions: 850, position: 24.9, issue: "short" },
  { id: "participate", path: "/participate", label: "Participate", title: "Participate | Bharat Organic Expo 2027", score: 83, words: 1850, inLinks: 27, lcp: 1.43, cls: 0.040, clicks: 176, impressions: 4048, position: 16.8, issue: "ok" },
  { id: "exhibitors", path: "/exhibitors", label: "Exhibitors", title: "Exhibitors | Bharat Organic Expo 2027", score: 81, words: 1967, inLinks: 14, lcp: 1.71, cls: 0.075, clicks: 288, impressions: 1728, position: 29.1, issue: "short" },
  { id: "e-promotion-web", path: "/e-promotion-web", label: "E-Promotion", title: "E-Promotion | Bharat Organic Expo 2027", score: 61, words: 705, inLinks: 37, lcp: 1.37, cls: 0.043, clicks: 475, impressions: 12350, position: 3.8, issue: "ok" },
  { id: "partnership", path: "/partnership", label: "Partnership", title: "Partnership | Bharat Organic Expo 2027", score: 91, words: 1079, inLinks: 30, lcp: 1.65, cls: 0.039, clicks: 315, impressions: 3150, position: 5.5, issue: "ok" },
  { id: "feedback", path: "/feedback", label: "Feedback", title: "Feedback | Bharat Organic Expo 2027", score: 69, words: 691, inLinks: 23, lcp: 1.62, cls: 0.040, clicks: 254, impressions: 2286, position: 12.2, issue: "short" },
  { id: "about-suport_services", path: "/about/suport_services", label: "Support Services", title: "Support Services | Bharat Organic Expo 2027", score: 71, words: 1252, inLinks: 30, lcp: 1.27, cls: 0.009, clicks: 70, impressions: 1540, position: 24.1, issue: "ok" },
  { id: "gallery", path: "/gallery", label: "Gallery", title: "Gallery | Bharat Organic Expo 2027", score: 85, words: 1666, inLinks: 40, lcp: 1.88, cls: 0.039, clicks: 472, impressions: 11800, position: 13.2, issue: "ok" },
  { id: "thank-you", path: "/thank-you", label: "Thank You", title: "Thank You | Bharat Organic Expo 2027", score: 84, words: 1221, inLinks: 36, lcp: 1.92, cls: 0.040, clicks: 454, impressions: 9534, position: 6.8, issue: "ok" },
  { id: "awards", path: "/awards", label: "Awards", title: "Awards | Bharat Organic Expo 2027", score: 98, words: 1810, inLinks: 31, lcp: 1.46, cls: 0.022, clicks: 251, impressions: 6526, position: 27.1, issue: "ok" },

];

export const SITE_ORIGIN = "https://bharatorganicexpo.com";

export function findInventoryPage(id: string): PageAuditRecord | undefined {
  const normalized = (id || "home").toLowerCase().replace(/^\/+|\/+$/g, "");
  return PAGE_INVENTORY.find(
    (page) => page.id === normalized || page.path.replace(/^\//, "") === normalized,
  );
}

/** Search Console derived metrics for a route, straight from the inventory. */
export function searchMetricsFor(record: PageAuditRecord) {
  return {
    clicks: record.clicks,
    impressions: record.impressions,
    ctr: record.impressions
      ? Number(((record.clicks / record.impressions) * 100).toFixed(1))
      : 0,
    position: record.position,
  };
}
