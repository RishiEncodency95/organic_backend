import { describe, expect, it } from 'vitest';
import { digestPage, siteMetrics } from '../../src/modules/website-intelligence/competitor-ai';
import { buildAnalyzerPrompts, validateCompare, validateProfiles } from '../../src/modules/competitor-analyzer/analyzer-ai';
import { diffRuns } from '../../src/modules/competitor-analyzer/analyzer-changes';
import { brandOf, movedTo, normalizeSite, onePageSections, pageRedirect, sameBusinessHost, statedRating, siteName, sitemapLocs, techSignals, type SiteEvidence } from '../../src/modules/competitor-analyzer/analyzer-evidence';

describe('site input', () => {
  it('turns a domain or link into the site root and a bare domain', () => {
    expect(normalizeSite('bharatorganicexpo.in')).toEqual({ url: 'https://bharatorganicexpo.in/', domain: 'bharatorganicexpo.in' });
    expect(normalizeSite('https://WWW.Biofach-India.com/en/visit?x=1')).toEqual({ url: 'https://www.biofach-india.com/', domain: 'biofach-india.com' });
    expect(normalizeSite('http://organics-millets.in')).toEqual({ url: 'http://organics-millets.in/', domain: 'organics-millets.in' });
  });

  it('refuses things that are not public websites', () => {
    for (const bad of ['', 'not a site', 'localhost:3000', 'http://127.0.0.1/', 'https://user:pw@example.com', 'ftp://example.com', 'printer.local']) {
      expect(normalizeSite(bad)).toBeNull();
    }
  });

  it('names a site from og:site_name, else the first part of the title', () => {
    expect(siteName('<meta property="og:site_name" content="BIOFACH India">', 'Home | Whatever')).toBe('BIOFACH India');
    expect(siteName('<html></html>', 'Bharat Organic Expo | Organic trade fair')).toBe('Bharat Organic Expo');
    expect(siteName('<html></html>', '')).toBeNull();
    expect(siteName('<html></html>', 'Home - Bharat Organic Expo')).toBe('Bharat Organic Expo');
    expect(siteName('<meta property="og:site_name" content="Tom &amp; Co">', '')).toBe('Tom & Co');
  });
});

describe('technical signals', () => {
  const home = `<html lang="en-IN"><head><title>Bharat Organic Expo</title><meta name="description" content="India's organic trade fair">
<link rel="canonical" href="https://x.in/"><meta property="og:image" content="/a.jpg"><meta name="viewport" content="width=device-width">
<meta property="article:modified_time" content="2026-09-01T10:00:00Z"></head>
<body><h1>Grow organic</h1><img src="a.jpg" alt="Hall"><img src="b.jpg"><a href="/blog/post">Blog</a><a href="/about">About</a><a href="https://other.com/">x</a></body></html>`;

  it('reads title, description, H1, canonical, OG, viewport, lang, alt coverage, links, blog and the newest date', () => {
    const t = techSignals(home, new URL('https://x.in/'), [home, '<time datetime="2026-10-01">Oct</time><time datetime="2099-01-01">future</time>'], new Date('2026-10-22'));
    expect(t).toEqual({
      titleLength: 19, descriptionLength: 26, h1Count: 1, headline: 'Grow organic', canonical: true, openGraph: true, viewport: true, lang: 'en-IN',
      imagesTotal: 2, imagesWithAlt: 1, internalLinks: 2, hasBlog: true, latestDate: '2026-10-01',
    });
  });

  it('counts sitemap page URLs and follows an index', () => {
    expect(sitemapLocs('<urlset><url><loc>https://x.in/</loc></url><url><loc> https://x.in/a </loc></url></urlset>')).toMatchObject({ pages: ['https://x.in/', 'https://x.in/a'], children: [] });
    expect(sitemapLocs('<sitemapindex><sitemap><loc>https://x.in/s1.xml</loc></sitemap></sitemapindex>')).toMatchObject({ pages: [], children: ['https://x.in/s1.xml'] });
  });

  it('detects JavaScript-style enquiry controls without a literal form tag', () => {
    const digest = digestPage('<main><input name="name"><textarea name="message"></textarea><button type="submit">Send enquiry</button></main>', new URL('https://x.in/contact'));
    expect(digest.contact.form).toBe(true);
  });
});

const page = (url: string) => ({ url, title: 'T', description: 'D', headings: ['H1: x'], text: 'words here', wordCount: 2, ctas: ['Register'], social: [], contact: { phone: false, email: true, whatsapp: false, form: true }, schemaTypes: [], image: null, imageCount: 0 });
const evidence = (domain: string, over: Partial<SiteEvidence> = {}): SiteEvidence => ({
  url: `https://${domain}/`, domain, role: 'competitor', reachable: true, error: null, name: domain, title: 'Home', description: 'Desc', image: null, screenshot: null, https: true,
  pages: [{ url: `https://${domain}/`, title: 'Home', description: 'Desc', words: 1000, headings: 5, ctas: ['Register'] }],
  metrics: siteMetrics({ domain, pages: [page(`https://${domain}/`)] }),
  tech: { titleLength: 20, descriptionLength: 100, h1Count: 1, headline: 'Hi', canonical: true, openGraph: true, viewport: true, lang: 'en', imagesTotal: 4, imagesWithAlt: 2, internalLinks: 20, hasBlog: false, latestDate: null, robotsTxt: true, sitemapUrls: 40 },
  speed: { performance: 50, seo: 90, accessibility: 80, bestPractices: 90, lcpMs: 4000, cls: 0.1, tbtMs: 300 }, speedError: null,
  brand: { status: 'not_found', name: null, description: null, wikipediaUrl: null },
  ...over,
});

describe('prompts', () => {
  it('label the client first and include measurements for every site in both prompts', () => {
    const sites = ['mine.in', 'them.com'].map((d) => ({ evidence: evidence(d), digest: { domain: d, pages: [page(`https://${d}/`)] } }));
    const p = buildAnalyzerPrompts(sites);
    expect(p.compare.user).toBe(p.profiles.user);
    expect(p.compare.user.indexOf('CLIENT website: mine.in')).toBeLessThan(p.compare.user.indexOf('COMPETITOR 1 website: them.com'));
    expect(p.compare.user).toContain('mobile performance 50/100');
    expect(p.compare.user).toContain('sitemap 40 URLs');
    expect(p.compare.system).toMatch(/Never claim anything about traffic/);
    expect(p.profiles.system).toMatch(/contentIdeas/);
  });
});

const input = { own: 'mine.in', competitors: ['a.com', 'b.com'], pages: { 'mine.in': ['https://mine.in/'], 'a.com': ['https://a.com/', 'https://a.com/visit'], 'b.com': ['https://b.com/'] } };

describe('comparison validation', () => {
  const answer = {
    overview: 'A leads on trust; you lead on contact.',
    scores: [
      { area: 'Trust & proof', scores: { 'mine.in': 4, 'a.com': 9, 'b.com': 9 }, note: 'Logos' },
      { area: 'ease of contact', scores: { 'mine.in': 8.6, 'a.com': 5, 'www.b.com': 6 }, note: '' },
      { area: 'Made up', scores: { 'mine.in': 1, 'a.com': 1 } },
      { area: 'Content depth', scores: { 'a.com': 9 } },
    ],
    headToHead: [
      { competitor: 'b.com', threat: 'severe', threatReason: 'Same audience', theyLead: [{ point: 'Visitor guide', url: 'https://b.com/' }], youLead: [{ point: 'WhatsApp', url: 'https://mine.in/' }, { point: 'Wrong side', url: 'https://b.com/' }], verdict: 'Close.' },
      { competitor: 'mine.in', theyLead: [], youLead: [], verdict: 'self' },
    ],
    gaps: [{ topic: 'Exhibitor list', competitors: ['a.com', 'zzz.com'], why: 'Proof', url: 'https://a.com/visit' }, { topic: 'Bad url', competitors: ['a.com'], url: 'https://b.com/' }],
    opportunities: ['Nobody shows prices', 'Nobody shows prices'],
    actions: [
      { priority: 'urgent', action: 'Publish event dates', reason: 'A shows them', effort: 'low', impact: 'high', when: 'This Week', learnFrom: 'www.a.com', evidenceUrls: ['https://a.com/visit'] },
      { priority: 'low', action: 'Copy something', learnFrom: 'mine.in', when: 'someday', evidenceUrls: ['https://mine.in/'] },
      { action: 'Get 10k followers' },
    ],
  };

  it('keeps cited points, computes leaders and overall itself, normalises threat, timing and impact', () => {
    const checked = validateCompare(JSON.stringify(answer), input);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    const r = checked.result;
    expect(r.scores.map((s) => s.area)).toEqual(['Trust & proof', 'Ease of contact']);
    expect(r.scores[0]!.leader).toBeNull();
    expect(r.scores[1]).toMatchObject({ leader: 'mine.in', scores: { 'mine.in': 9, 'b.com': 6 } });
    expect(r.overall).toEqual({ 'mine.in': 65, 'a.com': 70, 'b.com': 75 });
    expect(r.headToHead).toEqual([{ competitor: 'b.com', threat: 'medium', threatReason: 'Same audience', theyLead: [{ point: 'Visitor guide', url: 'https://b.com/' }], youLead: [{ point: 'WhatsApp', url: 'https://mine.in/' }], verdict: 'Close.' }]);
    expect(r.gaps).toEqual([{ topic: 'Exhibitor list', competitors: ['a.com'], why: 'Proof', url: 'https://a.com/visit' }]);
    expect(r.opportunities).toEqual(['Nobody shows prices']);
    expect(r.actions).toEqual([
      { priority: 'medium', action: 'Publish event dates', reason: 'A shows them', effort: 'low', impact: 'high', when: 'this week', learnFrom: 'a.com', evidenceUrls: ['https://a.com/visit'] },
      { priority: 'low', action: 'Copy something', reason: '', effort: 'medium', impact: 'medium', when: 'this month', learnFrom: null, evidenceUrls: ['https://mine.in/'] },
    ]);
    // Dropped: wrong-side point, self head-to-head, gap citing another site's page, forbidden follower claim.
    expect(checked.dropped).toBe(4);
  });

  it('rejects non-JSON and an answer without overview or actions', () => {
    expect(validateCompare('nope', input).ok).toBe(false);
    expect(validateCompare(JSON.stringify({ ...answer, overview: '' }), input).ok).toBe(false);
    expect(validateCompare(JSON.stringify({ ...answer, actions: [] }), input).ok).toBe(false);
  });
});

describe('profiles validation', () => {
  const answer = {
    sites: [
      { domain: 'https://www.a.com', summary: 'Trade fair.', promise: 'Meet buyers', tone: 'formal', strengths: [{ point: 'Clear dates', evidence: 'Header', url: 'https://a.com/visit' }, { point: 'Invented', evidence: 'x', url: 'https://a.com/nope' }], weaknesses: [] },
      { domain: 'mine.in', summary: 'Expo.', strengths: [{ point: 'Has 50k monthly visits', evidence: 'traffic', url: 'https://mine.in/' }], weaknesses: [{ point: 'No dates', evidence: 'Home', url: 'https://mine.in/' }] },
      { domain: 'unknown.org', summary: 'x' },
    ],
    swot: { strengths: ['Local focus'], weaknesses: ['Thin content'], opportunities: ['Millets content'], threats: ['A has 2x revenue', 'B targets the same buyers'] },
    topics: [{ topic: 'Organic certification', sites: ['b.com', 'www.mine.in', 'x.org'] }, { topic: 'organic certification', sites: ['a.com'] }, { topic: 'Nobody', sites: ['x.org'] }],
    contentIdeas: [{ title: 'Exhibitor guide 2026', format: 'guide', why: 'A has one', inspiredBy: 'a.com', outline: ['Who can exhibit', 'Stall sizes', 'Monthly visits we get'], keywords: ['Organic Expo Exhibitor', 'organic expo exhibitor', 'organic fair delhi'] }, { title: 'Our story', format: 'podcast', inspiredBy: 'zzz.com' }],
  };

  it('keeps known sites in study order, cited points, a clean SWOT, a topic map and content ideas', () => {
    const checked = validateProfiles(JSON.stringify(answer), input);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    const r = checked.result;
    expect(r.sites.map((s) => s.domain)).toEqual(['mine.in', 'a.com']);
    expect(r.sites[1]).toMatchObject({ promise: 'Meet buyers', tone: 'formal', strengths: [{ point: 'Clear dates', evidence: 'Header', url: 'https://a.com/visit' }] });
    expect(r.sites[0]!.strengths).toEqual([]);
    expect(r.swot.threats).toEqual(['B targets the same buyers']);
    expect(r.topics).toEqual([{ topic: 'Organic certification', sites: ['mine.in', 'b.com'] }]);
    expect(r.contentIdeas).toEqual([
      { title: 'Exhibitor guide 2026', format: 'guide', why: 'A has one', inspiredBy: 'a.com', outline: ['Who can exhibit', 'Stall sizes'], keywords: ['organic expo exhibitor', 'organic fair delhi'] },
      { title: 'Our story', format: 'page', why: '', inspiredBy: null, outline: [], keywords: [] },
    ]);
    // Dropped: uncited strength, forbidden visits claim, unknown site, forbidden revenue threat.
    expect(checked.dropped).toBe(4);
  });

  it('rejects profiles without the client site', () => {
    expect(validateProfiles(JSON.stringify({ ...answer, sites: answer.sites.filter((s) => s.domain !== 'mine.in') }), input).ok).toBe(false);
  });
});

describe('changes between runs', () => {
  it('reports new pages, rewritten titles, content, speed and score moves per site', () => {
    const before = evidence('a.com');
    const after = evidence('a.com', {
      title: 'New home',
      pages: [...before.pages, { url: 'https://a.com/exhibitors', title: 'Exhibitors', description: '', words: 500, headings: 3, ctas: [] }],
      metrics: { ...before.metrics, words: 2000, social: ['instagram.com'], schemaTypes: ['Event'] },
      speed: { ...before.speed!, performance: 70 },
      brand: { status: 'matched', name: 'A', description: null, wikipediaUrl: null },
    });
    const changes = diffRuns({ sites: [before], overall: { 'a.com': 60 } }, { sites: [after], overall: { 'a.com': 72 } });
    expect(changes.map((c) => c.kind)).toEqual(['pages', 'title', 'content', 'social', 'schema', 'speed', 'brand', 'score']);
    expect(changes.find((c) => c.kind === 'pages')!.text).toContain('/exhibitors');
  });

  it('reports a site that could not be read, and nothing for an unchanged one', () => {
    const a = evidence('a.com');
    expect(diffRuns({ sites: [a], overall: null }, { sites: [{ ...a, reachable: false, error: 'timeout' }], overall: null })).toEqual([{ domain: 'a.com', kind: 'reachability', direction: 'down', text: 'Site could not be read this time: timeout.' }]);
    expect(diffRuns({ sites: [a], overall: null }, { sites: [a], overall: null })).toEqual([]);
  });

  it('reports what changed on a page: main heading, title, a rewrite and the prices written on it', () => {
    const page = { url: 'https://a.com/pricing', title: 'Pricing', description: '', words: 400, headings: 4, ctas: [], kind: 'pricing' as const, h1: 'Stall packages 2026', prices: ['₹45,000', '₹80,000'] };
    const before = evidence('a.com', { pages: [page] });
    const after = evidence('a.com', { pages: [{ ...page, title: 'Pricing 2027', words: 650, h1: 'Stall packages 2027', prices: ['₹50,000', '₹80,000'] }] });
    const texts = diffRuns({ sites: [before], overall: null }, { sites: [after], overall: null }).map((c) => `${c.kind}: ${c.text}`);
    expect(texts).toEqual([
      'page: Main heading on /pricing changed from “Stall packages 2026” to “Stall packages 2027”.',
      'page: Title of /pricing changed from “Pricing” to “Pricing 2027”.',
      'page: /pricing was rewritten: 400 → 650 words.',
      'price: Prices on /pricing: now shows ₹50,000; no longer shows ₹45,000.',
    ]);
    // Older runs stored no h1 or prices and chose pages differently: page changes are not invented, one note says why.
    const old = evidence('a.com', { pages: [{ ...page, h1: undefined, prices: undefined }, { url: 'https://a.com/blog/post', title: 'Post', description: '', words: 900, headings: 2, ctas: [] }], metrics: { ...before.metrics, words: 9000 } });
    const versus = diffRuns({ sites: [old], overall: null }, { sites: [{ ...after, pages: [{ ...after.pages[0]!, title: 'Pricing', words: 400 }] }], overall: null });
    expect(versus).toEqual([{ domain: 'a.com', kind: 'pages', direction: 'neutral', text: expect.stringContaining('Page-by-page changes show from the next check') }]);
  });

  it('reports new products, moved prices, changed event facts and follower moves', () => {
    const offers = (prices: { label: string; value: string }[], dates: string | null) => ({
      domain: 'a.com', eventName: null, location: null, exhibitors: null, visitors: null, stallPrice: null, ticketPrice: null, deadline: null,
      dates: dates ? { value: dates, url: 'https://a.com/', quote: dates } : null,
      prices: prices.map((p) => ({ ...p, url: 'https://a.com/shop', quote: `${p.label} ${p.value}` })),
      claims: [],
    });
    const yt = (subscribers: number, videos: number) => ({ status: 'ok' as const, channelId: 'UC1', title: 'A', subscribers, videos, views: 1, lastUploadAt: null, url: 'https://youtube.com/@a' });
    const before = evidence('a.com', { socials: { profiles: [], youtube: yt(1000, 40), instagram: null, checkedAt: '' } });
    const after = evidence('a.com', { socials: { profiles: [], youtube: yt(1200, 43), instagram: null, checkedAt: '' } });
    const changes = diffRuns(
      { sites: [before], overall: null, offers: [offers([{ label: 'Millet 1 kg', value: 'Rs. 180' }, { label: 'Ragi 1 kg', value: 'Rs. 120' }], '12-14 Feb 2026')] },
      { sites: [after], overall: null, offers: [offers([{ label: 'Millet 1 kg', value: 'Rs. 199' }, { label: 'Jowar 1 kg', value: 'Rs. 99' }], '10-12 Feb 2027')] },
    );
    expect(changes.map((c) => `${c.kind}/${c.direction}: ${c.text}`)).toEqual([
      'offer/up: New priced offer: Jowar 1 kg (Rs. 99).',
      'offer/neutral: No longer lists: Ragi 1 kg.',
      'price/neutral: Price of “Millet 1 kg” changed from Rs. 180 to Rs. 199.',
      'offer/neutral: Event dates changed from 12-14 Feb 2026 to 10-12 Feb 2027.',
      'followers/up: YouTube subscribers 1,000 → 1,200.',
      'followers/up: Posted 3 new YouTube videos.',
    ]);
    // A run whose offers failed is not compared.
    expect(diffRuns({ sites: [before], overall: null, offers: null }, { sites: [before], overall: null, offers: [offers([], null)] })).toEqual([]);
  });
});

describe('addresses that send visitors to another website', () => {
  it('knows when two hosts are the same business', () => {
    expect(brandOf('www.acme.co.in')).toBe('acme');
    expect(brandOf('itpo.gov.in')).toBe('itpo');
    expect(brandOf('web.ensis.in')).toBe('ensis');
    expect(sameBusinessHost('keralaayurveda.biz', 'keralaayurveda.com')).toBe(true);
    expect(sameBusinessHost('ayurvedaworld.org', 'www.normwalker.com')).toBe(false);
    expect(sameBusinessHost('keralaayurveda.biz', 'www.google.com')).toBe(false);
  });

  it('reads script and meta-refresh forwards', () => {
    const base = new URL('https://indiatradefair.com/');
    expect(pageRedirect('<script>setTimeout(() => { window.location.href = "https://www.itpo.gov.in"; }, 5000)</script>', base)).toBe('https://www.itpo.gov.in/');
    expect(pageRedirect('<meta http-equiv="refresh" content="0; url=https://other.com/home">', base)).toBe('https://other.com/home');
    expect(pageRedirect('<script>location.href = "/contact"</script>', base)).toBeNull();
  });

  it('flags a home page that lands on, or forwards to, a different business', () => {
    // HTTP redirect to a spam site (ayurvedaworld.org → normwalker.com).
    expect(movedTo('https://ayurvedaworld.org/', 'https://www.normwalker.com/', '<h1>AGUNG11</h1>')).toBe('normwalker.com');
    // "Redirecting in 5 seconds…" page (indiatradefair.com → itpo.gov.in).
    expect(movedTo('https://indiatradefair.com/', 'https://indiatradefair.com/', '<h1>Redirecting in 5 seconds...</h1><script>window.location.href = "https://www.itpo.gov.in"</script>')).toBe('itpo.gov.in');
    // Same business on another ending, or a long page with a script link: not moved.
    expect(movedTo('https://keralaayurveda.biz/', 'https://keralaayurveda.com/', '<h1>Kerala Ayurveda</h1>')).toBeNull();
    expect(movedTo('https://acme.in/', 'https://acme.in/', `<p>${'word '.repeat(400)}</p><script>if (x) window.location.href = "https://pay.example.com"</script>`)).toBeNull();
  });
});

describe('one-page websites', () => {
  it('reads the sections a one-page site links to as its page kinds', () => {
    // Shaped like dignityfuneralservices.in: the whole menu points to sections of the home page.
    const html = '<nav><a href="#">Home</a><a href="#about">About</a><a href="#services">Services</a><a href="#gallery">Gallery</a><a href="#testimonials">Reviews</a><a href="#contact">Contact</a><a href="#content">Skip</a></nav>';
    expect(onePageSections(html).sort()).toEqual(['about', 'contact', 'gallery', 'services', 'testimonials']);
    expect(onePageSections('<a href="/about">About</a><a href="#top">Top</a>')).toEqual([]);
  });
});

describe('star rating a website states about itself', () => {
  it('reads AggregateRating from JSON-LD (designhouse.co.in), and from an escaped framework payload', () => {
    const html = `<script type="application/ld+json">{
	"@context": "http://schema.org", "@type": "product", "name": "Design House",
	"aggregateRating": { "@type": "AggregateRating", "ratingValue": "5", "ratingCount": "995", "reviewCount": "895" }
}</script>`;
    expect(statedRating(html, 'https://www.designhouse.co.in/')).toEqual({ value: 5, best: 5, ratings: 995, reviews: 895, about: 'Design House', url: 'https://www.designhouse.co.in/' });
    const escaped = '<script>self.__next_f.push([1,"{\\"@type\\":\\"AggregateRating\\",\\"ratingValue\\":\\"4.6\\",\\"bestRating\\":\\"5\\",\\"reviewCount\\":\\"120\\"}"])</script>';
    expect(statedRating(escaped, 'https://x.test/')).toMatchObject({ value: 4.6, best: 5, ratings: null, reviews: 120 });
  });

  it('ignores ratings without counts or out of range', () => {
    expect(statedRating('<script type="application/ld+json">{"aggregateRating":{"ratingValue":"5"}}</script>', 'https://x.test/')).toBeNull();
    expect(statedRating('<script type="application/ld+json">{"aggregateRating":{"ratingValue":"9","bestRating":"5","ratingCount":"10"}}</script>', 'https://x.test/')).toBeNull();
    expect(statedRating('<p>no data</p>', 'https://x.test/')).toBeNull();
  });
});
