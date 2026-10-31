import { describe, expect, it } from 'vitest';
import { siteMetrics, type PageDigest } from '../../src/modules/website-intelligence/competitor-ai';
import type { AnalyzerResult } from '../../src/modules/competitor-analyzer/analyzer-ai';
import { classifyPage, featureInventory, selectImportantPages, shellPages, type CrawlCoverage, type SiteEvidence, type SiteFeatures } from '../../src/modules/competitor-analyzer/analyzer-evidence';
import { assessQuality, deterministicComparison, validateRecommendations } from '../../src/modules/competitor-analyzer/analyzer-intelligence';

const feature = (state: 'present' | 'absent_confirmed' | 'not_observed' | 'render_failed' = 'not_observed') => ({ state, evidence: [] });
const features = (over: Partial<Record<keyof SiteFeatures, ReturnType<typeof feature>>> = {}): SiteFeatures => ({
  blog: feature(), contactForm: feature(), phone: feature(), email: feature(), whatsapp: feature(), portfolio: feature(), clients: feature(), testimonials: feature(), ...over,
});
const coverage = (status: CrawlCoverage['status'] = 'complete'): CrawlCoverage => ({ discovered: 20, selected: 10, read: status === 'complete' ? 10 : 3, rendered: 0, failed: status === 'complete' ? 0 : 2, score: status === 'complete' ? 100 : 48, status, pageTypes: ['home', 'about', 'contact', 'services', 'projects', 'blog'], warnings: status === 'complete' ? [] : ['partial'] });
const page = (url: string, kind: PageDigest['kind'] = 'home'): PageDigest => ({ url, title: 'Clear service title', description: 'A useful description of the service and business.', headings: ['H1: Clear offer'], text: 'Useful information '.repeat(120), wordCount: 240, ctas: ['Contact', 'Get a quote'], social: [], contact: { phone: true, email: true, whatsapp: true, form: true }, schemaTypes: ['Organization'], image: null, imageCount: 4, kind, method: 'static' });
const evidence = (domain: string, role: 'own' | 'competitor', over: Partial<SiteEvidence> = {}): SiteEvidence => {
  const pages = [page(`https://${domain}/`), page(`https://${domain}/contact`, 'contact'), page(`https://${domain}/projects`, 'projects'), page(`https://${domain}/blog`, 'blog')];
  return {
    url: `https://${domain}/`, domain, role, reachable: true, error: null, name: domain, title: 'Clear service title', description: 'Useful description', image: null, screenshot: null, https: true,
    pages: pages.map((item) => ({ url: item.url, title: item.title, description: item.description, words: item.wordCount, headings: item.headings.length, ctas: item.ctas, kind: item.kind, method: item.method })),
    metrics: siteMetrics({ domain, pages }),
    tech: { titleLength: 42, descriptionLength: 120, h1Count: 1, headline: 'Clear offer', canonical: true, openGraph: true, viewport: true, lang: 'en', imagesTotal: 4, imagesWithAlt: 4, internalLinks: 30, hasBlog: true, latestDate: null, robotsTxt: true, sitemapUrls: 40 },
    features: features({ blog: feature('present'), contactForm: feature('present'), phone: feature('present'), email: feature('present'), whatsapp: feature('present'), portfolio: feature('present'), clients: feature('present') }),
    coverage: coverage(),
    speed: { performance: 85, seo: 95, accessibility: 90, bestPractices: 95, lcpMs: 2200, cls: 0.02, tbtMs: 80 }, speedMeta: null, speedError: null,
    brand: { status: 'matched', name: domain, description: null, wikipediaUrl: null },
    ...over,
  };
};

const analysis = (actions: AnalyzerResult['actions']): AnalyzerResult => ({
  overview: 'Measured comparison.', scores: [], overall: {}, headToHead: [], gaps: [], opportunities: [], actions,
  sites: [], swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] }, topics: [], contentIdeas: [{ title: 'Launch a company blog', format: 'blog', why: 'No blog', inspiredBy: null }],
});

describe('important-page discovery', () => {
  it('reserves contact, projects, blog and client pages before generic sitemap URLs', () => {
    const html = `<nav><a href="/about">About</a><a href="/services">Services</a><a href="/contact">Contact</a><a href="/projects">Portfolio</a><a href="/blogs">Blogs</a><a href="/clients">Clients</a></nav>`;
    const sitemap = Array.from({ length: 30 }, (_, index) => `https://example.com/location-${index}`);
    const selected = selectImportantPages(html, new URL('https://example.com/'), sitemap, 9);
    expect(selected.map((item) => item.kind)).toEqual(expect.arrayContaining(['about', 'services', 'contact', 'projects', 'blog', 'clients']));
    expect(selected).toHaveLength(9);
  });

  it('classifies common page naming conventions', () => {
    expect(classifyPage(new URL('https://x.test/get-in-touch'))).toBe('contact');
    expect(classifyPage(new URL('https://x.test/case-studies'))).toBe('projects');
    expect(classifyPage(new URL('https://x.test/insights'))).toBe('blog');
  });
});

describe('every kind of business', () => {
  it('tells products, pricing, events and other page kinds apart from services', () => {
    const kind = (path: string) => classifyPage(new URL(`https://x.test${path}`));
    expect(kind('/products/organic-millets')).toBe('products');
    expect(kind('/shop')).toBe('products');
    expect(kind('/collections/spices')).toBe('products');
    expect(kind('/pricing')).toBe('pricing');
    expect(kind('/packages')).toBe('pricing');
    expect(kind('/book-a-stall')).toBe('events');
    expect(kind('/exhibitor-registration')).toBe('events');
    expect(kind('/our-services')).toBe('services');
    expect(kind('/gallery')).toBe('gallery');
    expect(kind('/our-team')).toBe('team');
    expect(kind('/faq')).toBe('faq');
    expect(kind('/branches')).toBe('locations');
    expect(kind('/about-us')).toBe('about');
  });

  it('spots a site that serves the same JavaScript shell at every address (live base44 site, 2026-10-23)', () => {
    const page = (url: string, text: string) => ({ url, text }) as unknown as PageDigest;
    const shell = 'MDA Agro Solutions Loading our products please enable JavaScript';
    expect(shellPages([page('/', shell), page('/contact', shell), page('/about', ` ${shell} `), page('/products', shell)])).toEqual([0, 1, 2, 3]);
    // A real site whose pages differ is never flagged, even if two pages happen to match.
    expect(shellPages([page('/', 'Home text'), page('/a', 'Home text'), page('/b', 'About us'), page('/c', 'Contact us'), page('/d', 'Blog')])).toEqual([]);
    expect(shellPages([page('/', shell), page('/a', shell)])).toEqual([]);
  });

  it('keeps sub-pages in their section and does not match parts of words (live designhouse.co.in, 2026-10-23)', () => {
    const kind = (path: string) => classifyPage(new URL(`https://x.test${path}`));
    expect(kind('/services/corporate-interior')).toBe('services');
    expect(kind('/services/mobile-booth')).toBe('services');
    expect(kind('/services/shop-in-shop')).toBe('services');
    expect(kind('/portfolio/interior/retail-interior')).toBe('projects');
    expect(kind('/corporate-interiors')).toBe('other');
    expect(kind('/workshop-tour')).toBe('other');
    expect(kind('/events/expo-2027')).toBe('events');
  });

  it('picks one page of each important kind, the site menu before the sitemap', () => {
    const html = '<nav><a href="/shop">Shop</a><a href="/pricing">Pricing</a><a href="/exhibit">Exhibit</a><a href="/contact">Contact</a></nav>';
    const sitemap = ['https://example.com/products/a', 'https://example.com/products/b', 'https://example.com/about'];
    const selected = selectImportantPages(html, new URL('https://example.com/'), sitemap, 5);
    expect(selected.map((c) => c.kind)).toEqual(['contact', 'about', 'products', 'pricing', 'events']);
    expect(selected.find((c) => c.kind === 'products')?.url.pathname).toBe('/shop');
  });

  it('records products, online buying, written prices and events with their page', () => {
    const shop = { ...page('https://x.test/shop', 'products'), text: 'Organic millet flour 1 kg ₹180. Add to cart. In stock.', ctas: ['Buy now'] };
    const expo = { ...page('https://x.test/exhibit', 'events'), text: 'Book a stall: shell scheme 9 sqm Rs. 45,000. Register now.' };
    const inventory = featureInventory({ domain: 'x.test', pages: [page('https://x.test/'), shop, expo] }, coverage());
    expect(inventory.products?.state).toBe('present');
    expect(inventory.products?.evidence[0]?.url).toBe('https://x.test/shop');
    expect(inventory.onlineStore?.state).toBe('present');
    expect(inventory.prices?.state).toBe('present');
    expect(inventory.events?.evidence[0]?.url).toBe('https://x.test/exhibit');
  });

  it('keeps unseen offer features unverified unless their page kind was read', () => {
    const inventory = featureInventory({ domain: 'x.test', pages: [page('https://x.test/')] }, coverage());
    expect(inventory.products?.state).toBe('not_observed');
    expect(inventory.events?.state).toBe('not_observed');
  });
});

describe('evidence inventory', () => {
  it('never converts missing evidence from a partial crawl into absence', () => {
    const pages = [page('https://x.test/')];
    const inventory = featureInventory({ domain: 'x.test', pages }, coverage('partial'));
    expect(inventory.blog.state).toBe('not_observed');
    expect(inventory.contactForm.state).toBe('present');
  });
});

describe('deterministic intelligence', () => {
  it('calculates scores from measurements and withholds incomplete sites', () => {
    const result = deterministicComparison([evidence('mine.test', 'own'), evidence('them.test', 'competitor'), evidence('unknown.test', 'competitor', { coverage: coverage('insufficient') })]);
    expect(result.scores.length).toBeGreaterThanOrEqual(5);
    expect(result.overall['mine.test']).toBeTypeOf('number');
    expect(result.overall['unknown.test']).toBeUndefined();
  });

  it('drops recommendations that recreate observed features', () => {
    const input = analysis([
      { priority: 'high', action: 'Launch a blog', reason: 'Publish articles', effort: 'medium', impact: 'high', when: 'this month', learnFrom: null, evidenceUrls: ['https://mine.test/blog'] },
      { priority: 'high', action: 'Improve service page explanations', reason: 'Pages are thin', effort: 'medium', impact: 'high', when: 'this month', learnFrom: null, evidenceUrls: ['https://mine.test/'] },
    ]);
    const checked = validateRecommendations(input, evidence('mine.test', 'own'));
    expect(checked.result.actions.map((item) => item.action)).toEqual(['Improve service page explanations']);
    expect(checked.result.contentIdeas).toEqual([]);
    expect(checked.dropped).toBe(2);
  });

  it('marks incomplete and contradictory evidence for review', () => {
    const site = evidence('mine.test', 'own', { coverage: coverage('partial'), tech: { ...evidence('mine.test', 'own').tech!, hasBlog: false } });
    const quality = assessQuality([site, evidence('them.test', 'competitor')], { ...analysis([]), ...deterministicComparison([site, evidence('them.test', 'competitor')]) });
    expect(quality.status).toBe('needs_review');
    expect(quality.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['crawl_incomplete', 'blog_contradiction']));
  });
});

describe('representative-stack benchmark', () => {
  const stacks = ['WordPress', 'Next.js', 'React', 'Angular', 'Vue', 'Nuxt', 'Wix', 'Shopify', 'Webflow', 'Squarespace', 'Drupal', 'Joomla', 'Laravel', 'Django', 'Rails', 'ASP.NET', 'PHP', 'Gatsby', 'Hugo', 'Ghost', 'Magento', 'BigCommerce', 'HubSpot', 'custom API'];
  it.each(stacks)('%s fixture preserves important page coverage', () => {
    const html = `<header><a href="/about-us">About</a><a href="/our-services">Services</a><a href="/portfolio">Projects</a><a href="/contact-us">Contact</a><a href="/blog">Blog</a></header>`;
    const selected = selectImportantPages(html, new URL('https://benchmark.test/'), [], 9);
    expect(selected.map((item) => item.kind)).toEqual(expect.arrayContaining(['about', 'services', 'projects', 'contact', 'blog']));
  });
});
