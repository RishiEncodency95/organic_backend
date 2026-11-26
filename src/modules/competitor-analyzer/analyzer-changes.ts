/**
 * What changed on each site since the previous completed run, from measured evidence and scores only. This is the
 * "keep an eye on them" view: new pages, rewritten titles and headings, price and offer changes, social followers,
 * speed and score moves.
 */

import type { SiteEvidence } from './analyzer-evidence';
import { OFFER_FIELDS, type OfferField, type OffersBlock, type SiteOffers } from './analyzer-offers';

export interface SiteChange {
  domain: string;
  kind: 'pages' | 'page' | 'price' | 'offer' | 'followers' | 'title' | 'description' | 'content' | 'cta' | 'social' | 'schema' | 'speed' | 'brand' | 'score' | 'reachability';
  /** For the site itself: up = it got stronger. */
  direction: 'up' | 'down' | 'neutral';
  text: string;
}

interface RunSnapshot {
  sites: SiteEvidence[];
  overall: Record<string, number> | null;
  /** Offers read by the AI in that run; only compared when both runs have them. */
  offers?: SiteOffers[] | null;
}

const OFFER_LABEL: Record<OfferField, string> = {
  eventName: 'Event name',
  dates: 'Event dates',
  location: 'Venue',
  exhibitors: 'Exhibitor count',
  visitors: 'Visitor count',
  stallPrice: 'Stall price',
  ticketPrice: 'Ticket price',
  deadline: 'Booking deadline',
};

const pathOf = (url: string) => {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return url;
  }
};

const list = (items: string[], max = 5) => (items.length > max ? `${items.slice(0, max).join(', ')} and ${items.length - max} more` : items.join(', '));
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** The offers of a run, only when that run read them successfully. */
export function completedOffers(block: OffersBlock | null | undefined): SiteOffers[] | null {
  return block?.status === 'completed' ? block.sites : null;
}

/** Changes on the pages both runs read: main heading, title, a big rewrite, prices written on the page. */
function pageChanges(before: SiteEvidence, now: SiteEvidence, push: (kind: SiteChange['kind'], direction: SiteChange['direction'], text: string) => void) {
  const beforeByPath = new Map(before.pages.map((p) => [pathOf(p.url), p]));
  for (const page of now.pages) {
    const path = pathOf(page.url);
    const old = beforeByPath.get(path);
    if (!old) continue;
    const name = path === '/' ? 'the home page' : path;
    if (old.h1 && page.h1 && norm(old.h1) !== norm(page.h1)) push('page', 'neutral', `Main heading on ${name} changed from “${old.h1}” to “${page.h1}”.`);
    if (path !== '/' && old.title && page.title && norm(old.title) !== norm(page.title)) push('page', 'neutral', `Title of ${name} changed from “${old.title}” to “${page.title}”.`);
    if (path !== '/' && old.words >= 100 && Math.abs(page.words - old.words) / old.words >= 0.25) {
      push('page', page.words > old.words ? 'up' : 'down', `${name} was rewritten: ${old.words.toLocaleString('en-IN')} → ${page.words.toLocaleString('en-IN')} words.`);
    }
    if (old.prices && page.prices) {
      const added = page.prices.filter((p) => !old.prices!.includes(p));
      const gone = old.prices.filter((p) => !page.prices!.includes(p));
      if (added.length || gone.length) {
        const parts = [added.length ? `now shows ${list(added)}` : '', gone.length ? `no longer shows ${list(gone)}` : ''].filter(Boolean);
        push('price', 'neutral', `Prices on ${name}: ${parts.join('; ')}.`);
      }
    }
  }
}

/** Changes in what the site sells: new or removed priced offers, a price that moved, event facts that changed. */
function offerChanges(before: SiteOffers, now: SiteOffers, push: (kind: SiteChange['kind'], direction: SiteChange['direction'], text: string) => void) {
  const oldPrices = new Map(before.prices.map((p) => [norm(p.label), p]));
  const nowPrices = new Map(now.prices.map((p) => [norm(p.label), p]));
  const added = now.prices.filter((p) => !oldPrices.has(norm(p.label)));
  const gone = before.prices.filter((p) => !nowPrices.has(norm(p.label)));
  if (added.length) push('offer', 'up', `New priced offer${added.length > 1 ? 's' : ''}: ${list(added.map((p) => `${p.label} (${p.value})`))}.`);
  if (gone.length) push('offer', 'neutral', `No longer lists: ${list(gone.map((p) => p.label))}.`);
  for (const p of now.prices) {
    const old = oldPrices.get(norm(p.label));
    if (old && norm(old.value) !== norm(p.value)) push('price', 'neutral', `Price of “${p.label}” changed from ${old.value} to ${p.value}.`);
  }
  for (const field of OFFER_FIELDS) {
    const a = before[field];
    const b = now[field];
    if (a && b && norm(a.value) !== norm(b.value)) push('offer', 'neutral', `${OFFER_LABEL[field]} changed from ${a.value} to ${b.value}.`);
    else if (!a && b && hadAnyFact(before)) push('offer', 'up', `${OFFER_LABEL[field]} is now stated: ${b.value}.`);
  }
}

/** Only report a newly stated fact when the earlier run read the site's offers at all (avoids noise after a failed read). */
const hadAnyFact = (s: SiteOffers) => OFFER_FIELDS.some((f) => s[f]) || s.prices.length > 0;

/** Follower moves of at least 5% (and at least 20 people), from the official YouTube and Instagram numbers. */
function followerChanges(before: SiteEvidence, now: SiteEvidence, push: (kind: SiteChange['kind'], direction: SiteChange['direction'], text: string) => void) {
  const moved = (label: string, a: number | null | undefined, b: number | null | undefined) => {
    if (a == null || b == null || a === b) return;
    const diff = b - a;
    if (Math.abs(diff) < 20 || (a > 0 && Math.abs(diff) / a < 0.05)) return;
    push('followers', diff > 0 ? 'up' : 'down', `${label} ${a.toLocaleString('en-IN')} → ${b.toLocaleString('en-IN')}.`);
  };
  const y0 = before.socials?.youtube;
  const y1 = now.socials?.youtube;
  if (y0?.status === 'ok' && y1?.status === 'ok' && y0.channelId === y1.channelId) {
    moved('YouTube subscribers', y0.subscribers, y1.subscribers);
    if (y1.videos > y0.videos) push('followers', 'up', `Posted ${y1.videos - y0.videos} new YouTube video${y1.videos - y0.videos > 1 ? 's' : ''}.`);
  }
  const i0 = before.socials?.instagram;
  const i1 = now.socials?.instagram;
  if (i0?.status === 'ok' && i1?.status === 'ok' && i0.username === i1.username) moved('Instagram followers', i0.followers, i1.followers);
}

/** Runs from before versioning: version 2 already stored prices per page (2026-10-23), older ones did not. */
const crawlVersionOf = (e: SiteEvidence) => e.crawlVersion ?? (e.pages.some((p) => Array.isArray(p.prices)) ? 2 : 1);

export function diffRuns(previous: RunSnapshot, current: RunSnapshot): SiteChange[] {
  const changes: SiteChange[] = [];
  let readingChanged = false;
  for (const now of current.sites) {
    const before = previous.sites.find((s) => s.domain === now.domain);
    if (!before) continue;
    const d = now.domain;
    const push = (kind: SiteChange['kind'], direction: SiteChange['direction'], text: string) => changes.push({ domain: d, kind, direction, text });

    if (before.reachable !== now.reachable) {
      push('reachability', now.reachable ? 'up' : 'down', now.reachable ? 'Site is reachable again.' : `Site could not be read this time${now.error ? `: ${now.error}` : ''}.`);
      continue;
    }
    if (!now.reachable) continue;
    // Pages chosen and read differently last time: differences in pages, words and buttons would be ours, not theirs.
    const samePageChoice = crawlVersionOf(before) === crawlVersionOf(now);
    if (!samePageChoice) readingChanged = true;

    if (samePageChoice) {
      const beforePaths = new Set(before.pages.map((p) => pathOf(p.url)));
      const nowPaths = new Set(now.pages.map((p) => pathOf(p.url)));
      const added = now.pages.filter((p) => !beforePaths.has(pathOf(p.url))).map((p) => (p.kind && p.kind !== 'other' ? `${pathOf(p.url)} (${p.kind})` : pathOf(p.url)));
      const removed = [...beforePaths].filter((p) => !nowPaths.has(p));
      if (added.length) push('pages', 'up', `New key page${added.length > 1 ? 's' : ''}: ${added.join(', ')}`);
      if (removed.length) push('pages', 'neutral', `No longer linked from the home page: ${removed.join(', ')}`);
    }

    if ((before.title ?? '') !== (now.title ?? '') && before.title && now.title) push('title', 'neutral', `Home page title changed from “${before.title}” to “${now.title}”.`);
    if ((before.description ?? '') !== (now.description ?? '') && now.description) push('description', 'neutral', before.description ? 'Home page meta description was rewritten.' : 'Home page now has a meta description.');
    if (samePageChoice) pageChanges(before, now, push);

    const o0 = previous.offers?.find((s) => s.domain === d);
    const o1 = current.offers?.find((s) => s.domain === d);
    if (o0 && o1) offerChanges(o0, o1, push);

    const w0 = before.metrics.words;
    const w1 = now.metrics.words;
    if (samePageChoice && w0 > 0 && Math.abs(w1 - w0) / w0 >= 0.1) push('content', w1 > w0 ? 'up' : 'down', `Words on the pages read went from ${w0.toLocaleString('en-IN')} to ${w1.toLocaleString('en-IN')}.`);
    if (samePageChoice && now.metrics.ctas !== before.metrics.ctas && Math.abs(now.metrics.ctas - before.metrics.ctas) >= 2) {
      push('cta', now.metrics.ctas > before.metrics.ctas ? 'up' : 'down', `Different calls to action: ${before.metrics.ctas} → ${now.metrics.ctas}.`);
    }
    const newSocial = now.metrics.social.filter((s) => !before.metrics.social.includes(s));
    if (newSocial.length) push('social', 'up', `Now links to ${newSocial.join(', ')}.`);
    followerChanges(before, now, push);
    const newSchema = now.metrics.schemaTypes.filter((s) => !before.metrics.schemaTypes.includes(s));
    if (newSchema.length) push('schema', 'up', `Added structured data: ${newSchema.join(', ')}.`);

    const p0 = before.speed?.performance;
    const p1 = now.speed?.performance;
    if (p0 != null && p1 != null && Math.abs(p1 - p0) >= 5) push('speed', p1 > p0 ? 'up' : 'down', `Mobile speed score ${p0} → ${p1}.`);
    if (before.brand?.status && now.brand?.status && before.brand.status !== now.brand.status && now.brand.status !== 'unavailable' && before.brand.status !== 'unavailable') {
      push('brand', now.brand.status === 'matched' ? 'up' : 'neutral', now.brand.status === 'matched' ? 'Google now knows this brand (Knowledge Graph).' : `Google brand match changed: ${before.brand.status} → ${now.brand.status}.`);
    }
    const s0 = previous.overall?.[d];
    const s1 = current.overall?.[d];
    if (s0 != null && s1 != null && Math.abs(s1 - s0) >= 5) push('score', s1 > s0 ? 'up' : 'down', `Overall score ${s0} → ${s1}.`);
  }
  if (readingChanged && current.sites[0]) {
    changes.unshift({ domain: current.sites[0].domain, kind: 'pages', direction: 'neutral', text: 'Pages are now chosen and read in an improved way, so new pages, words and buttons are not compared with the last check. Page-by-page changes show from the next check.' });
  }
  return changes;
}
