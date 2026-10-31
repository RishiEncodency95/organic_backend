/**
 * AI competitor analysis: page evidence, prompt and strict validation.
 *
 * The model only sees text we fetched from public pages (the competitor's and the client's own). It is told to use
 * nothing else, and every point it makes must name the page it came from; points that name a page we did not fetch are
 * dropped. Traffic, rankings, backlinks and revenue are never asked for, because public pages do not contain them.
 */

export const COMPETITOR_AI_PROMPT_VERSION = 'cmp-ai-2026-10-22.2';

/** Internal pages worth reading after the home page, matched on the link path or its text. */
const KEY_PAGE = /(about|who-we-are|our-story|mission|service|program|programme|project|initiative|product|solution|pricing|plans?|donat|contribut|support-us|volunteer|cause|case-stud|portfolio|work|course|treatment|contact)/i;
const SKIP_PAGE = /\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|mp4)$|\/(wp-admin|login|signin|cart|checkout|account|privacy|terms|cookie|tag|category|author|feed)\b/i;
const CTA_WORDS = /\b(donate|contribute|support|volunteer|join|sign ?up|register|subscribe|book|schedule|enquire|enquiry|inquire|contact|call|whatsapp|buy|shop|order|get (a )?quote|apply|download|start|learn more|get started)\b/i;
const SOCIAL = /(facebook\.com|fb\.com|instagram\.com|linkedin\.com|youtube\.com|youtu\.be|twitter\.com|x\.com|wa\.me|whatsapp\.com|t\.me|pinterest\.com|threads\.net|tiktok\.com)/i;

export const MAX_EXTRA_PAGES = 4;
const TEXT_CHARS_PER_PAGE = 1800;

export interface PageDigest {
  url: string;
  title: string;
  description: string;
  headings: string[];
  text: string;
  wordCount: number;
  ctas: string[];
  social: string[];
  /** Full social profile links (absolute), for profile look-ups. Older digests do not have them. */
  socialLinks?: string[];
  contact: { phone: boolean; email: boolean; whatsapp: boolean; form: boolean };
  schemaTypes: string[];
  /** Share image (og:image / twitter:image), absolute; shown as the site preview. */
  image: string | null;
  imageCount: number;
  kind?: 'home' | 'about' | 'contact' | 'services' | 'products' | 'pricing' | 'events' | 'projects' | 'gallery' | 'blog' | 'team' | 'faq' | 'locations' | 'clients' | 'testimonials' | 'other';
  method?: 'static' | 'rendered';
}

export interface SiteDigest {
  domain: string;
  pages: PageDigest[];
}

function decode(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:0*39|x0*27);/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

/** Visible text: scripts, styles and markup removed, entities decoded, whitespace collapsed. */
export function visibleText(html: string): string {
  return decode(
    html
      .replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

const attr = (tag: string, name: string) => new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)`, 'i').exec(tag)?.[1] ?? '';
const unique = <T>(items: T[]) => [...new Set(items)];

/** The evidence one page contributes, small enough to put several pages in one prompt. */
export function digestPage(html: string, url: URL): PageDigest {
  const body = /<body[\s\S]*<\/body>/i.exec(html)?.[0] ?? html;
  // Some sites leave <main> almost empty and put the content beside it; then the page without header/nav/footer is used.
  const chromeless = body.replace(/<(header|nav|footer)\b[\s\S]*?<\/\1>/gi, ' ');
  const mainHtml = /<main[\s\S]*<\/main>/i.exec(body)?.[0];
  const words = (fragment: string) => (visibleText(fragment).match(/\S+/g) ?? []).length;
  const main = mainHtml && words(mainHtml) >= Math.max(60, words(chromeless) * 0.3) ? mainHtml : chromeless;
  const text = visibleText(main);
  const headings = [...body.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((m) => `H${m[1]}: ${visibleText(m[2] ?? '').slice(0, 140)}`)
    .filter((h) => h.length > 4);
  const anchors = [...body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((m) => ({ href: attr(m[1] ?? '', 'href'), text: visibleText(m[2] ?? '').slice(0, 60) }));
  const buttons = [...body.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)].map((m) => visibleText(m[1] ?? '').slice(0, 60));
  const ctas = unique([...anchors.map((a) => a.text), ...buttons].filter((t) => t.length > 1 && t.length <= 60 && CTA_WORDS.test(t)));
  const social = unique(
    anchors
      .map((a) => a.href)
      .filter((href) => SOCIAL.test(href))
      .map((href) => {
        try {
          return new URL(href, url).hostname.replace(/^www\./, '');
        } catch {
          return '';
        }
      })
      .filter(Boolean),
  );
  const socialLinks = unique(
    anchors
      .map((a) => a.href)
      .filter((href) => SOCIAL.test(href))
      .flatMap((href) => {
        try {
          const abs = new URL(href, url);
          return /^https?:$/.test(abs.protocol) ? [abs.href] : [];
        } catch {
          return [];
        }
      }),
  );
  const schemaTypes = unique(
    [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].flatMap((m) => {
      try {
        const found: string[] = [];
        const walk = (node: unknown) => {
          if (Array.isArray(node)) node.forEach(walk);
          else if (node && typeof node === 'object') {
            const type = (node as Record<string, unknown>)['@type'];
            if (typeof type === 'string') found.push(type);
            else if (Array.isArray(type)) found.push(...type.filter((t): t is string => typeof t === 'string'));
            Object.values(node).forEach((v) => typeof v === 'object' && walk(v));
          }
        };
        walk(JSON.parse(m[1] ?? ''));
        return found;
      } catch {
        return [];
      }
    }),
  );
  const controls = (body.match(/<(input|textarea|select)\b/gi) ?? []).length;
  const formLike = /<form\b/i.test(body) || (controls >= 2 && /\b(send|submit|enquir|inquir|message|requirement|get in touch)\b/i.test(text));
  return {
    url: url.href,
    title: visibleText(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '').slice(0, 200),
    description: decode(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i.exec(html)?.[1] ?? /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i.exec(html)?.[1] ?? '').slice(0, 300),
    headings: unique(headings).slice(0, 25),
    text: text.slice(0, TEXT_CHARS_PER_PAGE),
    wordCount: text ? text.split(/\s+/).length : 0,
    ctas: ctas.slice(0, 12),
    social: social.slice(0, 10),
    socialLinks: socialLinks.slice(0, 15),
    contact: {
      phone: /href=["']tel:/i.test(body),
      email: /href=["']mailto:/i.test(body),
      whatsapp: /wa\.me|api\.whatsapp\.com|whatsapp/i.test(body),
      form: formLike,
    },
    schemaTypes: schemaTypes.slice(0, 15),
    image: shareImage(html, url),
    imageCount: (main.match(/<img\b/gi) ?? []).length,
  };
}

function shareImage(html: string, url: URL): string | null {
  const tag = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]).find((t) => /(property|name)\s*=\s*["'](og:image|twitter:image)["']/i.test(t));
  const src = tag ? attr(tag, 'content') : '';
  if (!src) return null;
  try {
    const abs = new URL(decode(src), url);
    return abs.protocol === 'https:' ? abs.href.slice(0, 500) : null;
  } catch {
    return null;
  }
}

export interface SiteMetrics {
  pages: number;
  words: number;
  headings: number;
  ctas: number;
  images: number;
  contact: { phone: boolean; email: boolean; whatsapp: boolean; form: boolean };
  social: string[];
  schemaTypes: string[];
  image: string | null;
}

/** Counts measured from the pages that were read (not estimated); drawn as the side-by-side comparison. */
export function siteMetrics(site: SiteDigest): SiteMetrics {
  const pages = site.pages;
  return {
    pages: pages.length,
    words: pages.reduce((sum, p) => sum + p.wordCount, 0),
    headings: pages.reduce((sum, p) => sum + p.headings.length, 0),
    ctas: unique(pages.flatMap((p) => p.ctas.map((c) => c.toLowerCase()))).length,
    images: pages.reduce((sum, p) => sum + p.imageCount, 0),
    contact: {
      phone: pages.some((p) => p.contact.phone),
      email: pages.some((p) => p.contact.email),
      whatsapp: pages.some((p) => p.contact.whatsapp),
      form: pages.some((p) => p.contact.form),
    },
    social: unique(pages.flatMap((p) => p.social.map((s) => s.replace(/^(m|web)\./, '')))).slice(0, 10),
    schemaTypes: unique(pages.flatMap((p) => p.schemaTypes)).slice(0, 20),
    image: pages[0]?.image ?? null,
  };
}

/** Up to MAX_EXTRA_PAGES internal pages that say most about the business (about, services, donate, contact…), in page order. */
export function pickKeyPages(html: string, base: URL): URL[] {
  const host = base.hostname.replace(/^www\./, '');
  const picked: URL[] = [];
  const seen = new Set<string>([base.origin + base.pathname]);
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attr(m[1] ?? '', 'href');
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript|data):/i.test(href)) continue;
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol) || url.hostname.replace(/^www\./, '') !== host) continue;
    url.hash = '';
    url.search = '';
    const key = url.origin + url.pathname;
    if (seen.has(key) || url.pathname === '/' || SKIP_PAGE.test(url.pathname)) continue;
    const label = visibleText(m[2] ?? '');
    if (!KEY_PAGE.test(url.pathname) && !KEY_PAGE.test(label)) continue;
    seen.add(key);
    picked.push(url);
    if (picked.length >= MAX_EXTRA_PAGES) break;
  }
  return picked;
}

/* ---------------------------------------------------------------- */
/* Prompt                                                            */
/* ---------------------------------------------------------------- */

const SYSTEM = `You are a senior marketing and SEO strategist comparing two organisations' websites for the first organisation (the client).
Use ONLY the page evidence provided. Do not use outside knowledge about either organisation, and do not guess numbers.
Never claim anything about traffic, search rankings, backlinks, revenue, donations raised or social follower counts: the evidence does not contain them.
Every point must cite the URL of the page it comes from, copied exactly from the evidence.
Write plain, specific English a small business owner understands. Prefer concrete observations ("their donate button is on every page") over generic advice.
Be brief: a point or action is one short sentence (max 14 words); evidence, why and reason are max 20 words.
Return only a JSON object with exactly these keys:
{
  "summary": "max 2 sentences: who the competitor is, what they offer, to whom",
  "scores": [{"area": "one of: Message clarity | Trust & proof | Calls to action | Content depth | Ease of contact | Search basics", "you": 0-10, "them": 0-10, "note": "max 12 words why"}],
  "audience": "who their website speaks to",
  "offerings": ["main services, programmes or products, max 8"],
  "positioning": "their value proposition and tone in one or two sentences",
  "theyDoBetter": [{"point": "...", "evidence": "what on the page shows it", "url": "page url"}],
  "youDoBetter": [{"point": "...", "evidence": "...", "url": "client page url"}],
  "contentGaps": [{"topic": "topic or page the competitor covers and the client does not", "why": "why it matters", "url": "competitor page url"}],
  "keywordThemes": ["search themes the competitor's pages target, taken from titles and headings, max 12"],
  "conversion": {"ctas": ["their calls to action, max 8"], "trustSignals": ["certifications, testimonials, numbers, partners shown, max 8"]},
  "actions": [{"priority": "high|medium|low", "action": "what the client should do", "reason": "based on which evidence", "effort": "low|medium|high"}]
}
Limits: scores has all six areas once each, judged only from the pages; theyDoBetter, youDoBetter max 6 each; contentGaps max 8; actions 3 to 8, most important first.`;

function pageBlock(page: PageDigest): string {
  return [
    `URL: ${page.url}`,
    `Title: ${page.title || '(none)'}`,
    `Meta description: ${page.description || '(none)'}`,
    `Headings: ${page.headings.join(' | ') || '(none)'}`,
    `Calls to action: ${page.ctas.join(' | ') || '(none)'}`,
    `Contact options: phone ${page.contact.phone ? 'yes' : 'no'}, email ${page.contact.email ? 'yes' : 'no'}, WhatsApp ${page.contact.whatsapp ? 'yes' : 'no'}, form ${page.contact.form ? 'yes' : 'no'}`,
    `Social profiles linked: ${page.social.join(', ') || '(none)'}`,
    `Structured data: ${page.schemaTypes.join(', ') || '(none)'}`,
    `Visible words: ${page.wordCount}`,
    `Text excerpt: ${page.text || '(none)'}`,
  ].join('\n');
}

export function buildCompetitorPrompt(own: SiteDigest, competitor: SiteDigest): { system: string; user: string } {
  const user = [
    `CLIENT website (${own.domain}), ${own.pages.length} page(s):`,
    ...own.pages.map((p, i) => `--- client page ${i + 1} ---\n${pageBlock(p)}`),
    '',
    `COMPETITOR website (${competitor.domain}), ${competitor.pages.length} page(s):`,
    ...competitor.pages.map((p, i) => `--- competitor page ${i + 1} ---\n${pageBlock(p)}`),
  ].join('\n');
  return { system: SYSTEM, user };
}

/* ---------------------------------------------------------------- */
/* Validation                                                        */
/* ---------------------------------------------------------------- */

export interface CitedPoint {
  point: string;
  evidence: string;
  url: string;
}

export const SCORE_AREAS = ['Message clarity', 'Trust & proof', 'Calls to action', 'Content depth', 'Ease of contact', 'Search basics'] as const;

export interface CompetitorAiResult {
  summary: string;
  scores: { area: (typeof SCORE_AREAS)[number]; you: number; them: number; note: string }[];
  audience: string;
  offerings: string[];
  positioning: string;
  theyDoBetter: CitedPoint[];
  youDoBetter: CitedPoint[];
  contentGaps: { topic: string; why: string; url: string }[];
  keywordThemes: string[];
  conversion: { ctas: string[]; trustSignals: string[] };
  actions: { priority: 'high' | 'medium' | 'low'; action: string; reason: string; effort: 'low' | 'medium' | 'high' }[];
}

const str = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const strList = (value: unknown, maxItems: number, maxLen = 120) => (Array.isArray(value) ? unique(value.map((v) => str(v, maxLen)).filter(Boolean)).slice(0, maxItems) : []);
const FORBIDDEN = /\b(traffic|visitors per|monthly visits|backlinks?|domain authority|ranks? (#|number|first|1st)|revenue|turnover|followers)\b/i;

/**
 * Parses and checks the model's answer. Points citing a page we did not fetch, and claims about metrics the evidence
 * cannot contain, are dropped and counted. The answer is rejected if nothing useful is left.
 */
export function validateCompetitorAi(
  text: string,
  urls: { own: string[]; competitor: string[] },
): { ok: true; result: CompetitorAiResult; dropped: number } | { ok: false; reason: string } {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'The AI answer was not valid JSON.' };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'The AI answer was empty.' };

  let dropped = 0;
  const ownSet = new Set(urls.own);
  const competitorSet = new Set(urls.competitor);
  const cited = (value: unknown, allowed: Set<string>, max: number): CitedPoint[] => {
    if (!Array.isArray(value)) return [];
    const out: CitedPoint[] = [];
    for (const item of value) {
      const point = str(item?.point, 300);
      const evidence = str(item?.evidence, 400);
      const url = str(item?.url, 500);
      if (!point || !allowed.has(url) || FORBIDDEN.test(`${point} ${evidence}`)) {
        dropped += 1;
        continue;
      }
      out.push({ point, evidence, url });
      if (out.length >= max) break;
    }
    return out;
  };

  const contentGaps: CompetitorAiResult['contentGaps'] = [];
  for (const item of Array.isArray(raw.contentGaps) ? raw.contentGaps : []) {
    const topic = str(item?.topic, 200);
    const url = str(item?.url, 500);
    if (!topic || !competitorSet.has(url)) {
      dropped += 1;
      continue;
    }
    contentGaps.push({ topic, why: str(item?.why, 300), url });
    if (contentGaps.length >= 8) break;
  }

  const actions: CompetitorAiResult['actions'] = [];
  for (const item of Array.isArray(raw.actions) ? raw.actions : []) {
    const action = str(item?.action, 300);
    if (!action || FORBIDDEN.test(action)) {
      dropped += 1;
      continue;
    }
    const priority = ['high', 'medium', 'low'].includes(item?.priority) ? item.priority : 'medium';
    const effort = ['low', 'medium', 'high'].includes(item?.effort) ? item.effort : 'medium';
    actions.push({ priority, action, reason: str(item?.reason, 400), effort });
    if (actions.length >= 8) break;
  }

  const scores: CompetitorAiResult['scores'] = [];
  const score = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.min(10, Math.max(0, value))) : null);
  for (const item of Array.isArray(raw.scores) ? raw.scores : []) {
    const area = SCORE_AREAS.find((a) => a.toLowerCase() === str(item?.area, 40).toLowerCase());
    const you = score(item?.you);
    const them = score(item?.them);
    if (!area || you === null || them === null || scores.some((s) => s.area === area)) continue;
    scores.push({ area, you, them, note: str(item?.note, 160) });
  }
  scores.sort((a, b) => SCORE_AREAS.indexOf(a.area) - SCORE_AREAS.indexOf(b.area));

  const result: CompetitorAiResult = {
    summary: str(raw.summary, 900),
    scores,
    audience: str(raw.audience, 300),
    offerings: strList(raw.offerings, 8),
    positioning: str(raw.positioning, 400),
    theyDoBetter: cited(raw.theyDoBetter, competitorSet, 6),
    youDoBetter: cited(raw.youDoBetter, ownSet, 6),
    contentGaps,
    keywordThemes: strList(raw.keywordThemes, 12, 60),
    conversion: { ctas: strList(raw.conversion?.ctas, 8, 80), trustSignals: strList(raw.conversion?.trustSignals, 8, 160) },
    actions,
  };
  if (!result.summary || result.actions.length === 0) return { ok: false, reason: 'The AI answer had no summary or no actions that passed the checks.' };
  return { ok: true, result, dropped };
}
