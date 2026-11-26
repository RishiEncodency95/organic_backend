import { activeBusinessConfig, matchServiceCategories, type PageKind } from "../taxonomy";

/** Classifies a same-site URL (and optional link label) into a page kind using the business configuration. */
export function classifyPage(url: string, label = ""): PageKind {
  let path = "/";
  try {
    path = decodeURIComponent(new URL(url).pathname.toLowerCase());
  } catch {
    return "other";
  }
  if (path === "/" || /^\/(index(\.html?|\.php)?|home)\/?$/.test(path)) return "home";
  const lowerLabel = label.toLowerCase();
  const kinds = activeBusinessConfig().pageKinds;
  // Service-detail paths often contain a generic word too (e.g. /services/cremation): prefer the more specific kind.
  if (/^\/services?\/[^/]+/.test(path)) return "service_detail";
  // URL path decides first; the link label is only a fallback (labels often contain service words).
  for (const k of kinds) if (k.patterns.some((p) => p.test(path))) return k.kind;
  if (lowerLabel) for (const k of kinds) if (k.patterns.some((p) => p.test(lowerLabel))) return k.kind;
  return "other";
}

export function kindPriority(kind: PageKind): number {
  if (kind === "home") return 100;
  return activeBusinessConfig().pageKinds.find((k) => k.kind === kind)?.priority ?? 10;
}

export interface PageCandidate {
  url: string;
  kind: PageKind;
  label: string;
  source: "home_link" | "sitemap" | "root";
  priority: number;
}

/**
 * Picks up to `limit` pages: home first, then one page per distinct kind by priority (breadth), then the remaining
 * highest-priority candidates. Shorter paths win ties (hub pages before deep pages).
 */
export interface SamplingFocus { serviceFocus?: string[]; places?: string[] }
export function focusMatch(url: string, label: string, focus: SamplingFocus) {
  let path = "";
  try { path = decodeURIComponent(new URL(url).pathname).replace(/[-_/]+/g, " "); } catch { /* invalid URL has no match */ }
  const text = `${path} ${label}`.toLowerCase();
  const services = matchServiceCategories(text).filter((s) => focus.serviceFocus?.includes(s));
  const places = (focus.places ?? []).filter((p) => {
    const needle = p.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
    return !!needle && (` ${text.replace(/[^\p{L}\p{N}]+/gu, " ")} `).includes(` ${needle} `);
  });
  return { services, places };
}

export function selectPages(candidates: PageCandidate[], limit: number, focus: SamplingFocus = {}): PageCandidate[] {
  const byUrl = new Map<string, PageCandidate>();
  for (const c of candidates) {
    const prev = byUrl.get(c.url);
    if (!prev || c.priority > prev.priority || (prev.source === "sitemap" && c.source === "home_link")) byUrl.set(c.url, c);
  }
  const depth = (u: string) => {
    try {
      return new URL(u).pathname.split("/").filter(Boolean).length;
    } catch {
      return 99;
    }
  };
  const sorted = [...byUrl.values()].sort((a, b) => b.priority - a.priority || (a.source === "home_link" ? -1 : 0) - (b.source === "home_link" ? -1 : 0) || depth(a.url) - depth(b.url) || a.url.localeCompare(b.url));
  const picked: PageCandidate[] = [];
  const kinds = new Set<string>();
  if (focus.serviceFocus?.length || focus.places?.length) {
    // Retain core audit pages, then prioritise shared service/city targets within the same budget.
    for (const kind of ["home", "contact", "services", "pricing", "about"]) {
      const c = sorted.find((p) => p.kind === kind);
      if (c && picked.length < limit) { picked.push(c); kinds.add(kind); }
    }
    const targeted = sorted.map((c) => ({ c, m: focusMatch(c.url, c.label, focus) }))
      .sort((a, b) => (b.m.services.length ? 10 : 0) + (b.m.places.length ? 5 : 0) - ((a.m.services.length ? 10 : 0) + (a.m.places.length ? 5 : 0)) || b.c.priority - a.c.priority || a.c.url.localeCompare(b.c.url));
    const add = (c?: PageCandidate) => { if (c && picked.length < limit && !picked.includes(c)) { picked.push(c); kinds.add(c.kind); } };
    for (const service of focus.serviceFocus ?? []) add(targeted.find(({ c, m }) => !picked.includes(c) && m.services.includes(service))?.c);
    for (const place of focus.places ?? []) add(targeted.find(({ c, m }) => !picked.includes(c) && m.places.includes(place))?.c);
    for (const { c, m } of targeted) if (m.services.length || m.places.length) add(c);
  }
  for (const c of sorted) {
    if (picked.length >= limit) break;
    if (c.kind === "other" || kinds.has(c.kind)) continue;
    kinds.add(c.kind);
    picked.push(c);
  }
  for (const c of sorted) {
    if (picked.length >= limit) break;
    if (!picked.includes(c)) picked.push(c);
  }
  return picked;
}
