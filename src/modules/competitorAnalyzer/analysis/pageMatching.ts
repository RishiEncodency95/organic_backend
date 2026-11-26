import { focusMatch } from "../crawler/classify";
import type { SiteCrawl } from "../crawler/crawler";

/** Pair observed service pages, preferring the same requested city. No ranking or equivalence is inferred. */
export function matchingPages(sites: { role: string; crawl: SiteCrawl }[], services: string[], places: string[]) {
  const pages = (crawl: SiteCrawl) => crawl.pages.filter((p) => p.state === "read" && p.extract && p.kind !== "home")
    .map((p) => ({ url: p.finalUrl ?? p.url, title: p.extract!.title, ...focusMatch(p.finalUrl ?? p.url, `${p.extract!.title ?? ""} ${p.extract!.headings.filter((h) => h.level <= 2).map((h) => h.text).join(" ")}`, { serviceFocus: services, places }) }));
  const own = sites.find((s) => s.role === "own");
  if (!own) return [];
  const ownPages = pages(own.crawl);
  return sites.filter((s) => s.role === "competitor").flatMap((s) => {
    const rival = pages(s.crawl);
    return services.map((service) => {
      const a = ownPages.filter((p) => p.services.includes(service));
      const b = rival.filter((p) => p.services.includes(service));
      const city = places.find((p) => a.some((x) => x.places.includes(p)) && b.some((x) => x.places.includes(p))) ?? null;
      const best = (list: typeof a) => (city ? list.find((p) => p.places.includes(city)) : null) ?? list[0];
      return { competitor: s.crawl.domain, service, place: city, ownPage: best(a) ?? null, competitorPage: best(b) ?? null, status: a.length && b.length ? (city ? "service_and_city" : "service_only") : "missing_sample", note: "Matched by service terms in URL/title/headings. Missing means not found in this bounded sample; review scope before comparing prices." };
    });
  });
}
