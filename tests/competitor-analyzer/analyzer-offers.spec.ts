import { describe, expect, it } from 'vitest';
import { catalogueText, emptyOffers, hasOffers, offerSnippets, offersUserPrompt, siteCatalogue, validateOffers } from '../../src/modules/competitor-analyzer/analyzer-offers';

const expoPage = {
  url: 'https://expo.test/exhibit',
  text: `${'Intro text about organic farming. '.repeat(40)}Bharat Organic Expo 2027 will be held on 12-14 February 2027 at Bharat Mandapam, New Delhi. Shell scheme stall (9 sqm): ₹45,000 + GST. Over 300 exhibitors and 15,000 trade visitors expected. Last date for booking: 31 December 2026. ${'Closing words. '.repeat(30)}`,
};
const shopPage = { url: 'https://shop.test/products', text: 'Foxtail millet 1 kg Rs. 180. Little millet 500 g Rs. 95. Free delivery above Rs. 999. Serving customers since 2012 across 20 states.' };

describe('offer excerpts', () => {
  it('keeps only the text around prices, dates and event words', () => {
    const [excerpt] = offerSnippets([expoPage]);
    expect(excerpt?.url).toBe(expoPage.url);
    expect(excerpt?.text).toContain('₹45,000');
    expect(excerpt?.text).toContain('12-14 February 2027');
    expect(excerpt!.text.length).toBeLessThan(expoPage.text.length);
  });

  it('skips pages that mention nothing of the kind and caps each site', () => {
    expect(offerSnippets([{ url: 'https://x.test/', text: 'We are a friendly team.' }])).toEqual([]);
    const long = { url: 'https://x.test/p', text: 'stall ₹1,000 '.repeat(2000) };
    expect(offerSnippets([long])[0]!.text.length).toBeLessThanOrEqual(4500);
  });

  it('labels every excerpt with its site and page in the prompt', () => {
    const prompt = offersUserPrompt([{ domain: 'expo.test', excerpts: offerSnippets([expoPage]) }, { domain: 'quiet.test', excerpts: [] }]);
    expect(prompt).toContain('### expo.test');
    expect(prompt).toContain('[https://expo.test/exhibit]');
    expect(prompt).toContain('(no excerpts about products, events or offers)');
  });
});

describe('offer validation', () => {
  const sites = [{ domain: 'expo.test', pages: [expoPage] }, { domain: 'shop.test', pages: [shopPage] }];

  it('keeps facts whose quote is on the page and whose numbers are in the quote', () => {
    const reply = JSON.stringify({
      sites: [
        {
          domain: 'expo.test',
          dates: { value: '12-14 February 2027', url: expoPage.url, quote: 'will be held on 12-14 February 2027 at Bharat Mandapam' },
          location: { value: 'Bharat Mandapam, New Delhi', url: expoPage.url, quote: 'at Bharat Mandapam, New Delhi' },
          stallPrice: { value: '₹45,000 per 9 sqm stall', url: expoPage.url, quote: 'Shell scheme stall (9 sqm): ₹45,000 + GST' },
          exhibitors: { value: '300+', url: expoPage.url, quote: 'Over 300 exhibitors' },
          visitors: { value: '15,000 trade visitors', url: expoPage.url, quote: '15,000 trade visitors expected' },
          deadline: { value: '31 December 2026', url: expoPage.url, quote: 'Last date for booking: 31 December 2026' },
        },
        { domain: 'https://www.shop.test/', prices: [{ label: 'Foxtail millet 1 kg', value: 'Rs. 180', url: shopPage.url, quote: 'Foxtail millet 1 kg Rs. 180' }], claims: [{ label: 'Since', value: '2012', url: shopPage.url, quote: 'Serving customers since 2012' }] },
      ],
    });
    const out = validateOffers(reply, sites)!;
    expect(out.dropped).toBe(0);
    expect(out.sites[0]!.stallPrice?.value).toBe('₹45,000 per 9 sqm stall');
    expect(out.sites[0]!.eventName).toBeNull();
    expect(out.sites[1]!.prices[0]).toMatchObject({ label: 'Foxtail millet 1 kg', value: 'Rs. 180' });
    expect(out.sites[1]!.claims).toHaveLength(1);
    expect(hasOffers(out.sites[1]!)).toBe(true);
  });

  it('drops invented quotes, wrong pages and numbers that are not in the quote', () => {
    const reply = JSON.stringify({
      sites: [
        {
          domain: 'expo.test',
          stallPrice: { value: '₹40,000', url: expoPage.url, quote: 'Shell scheme stall (9 sqm): ₹40,000' },
          visitors: { value: '50,000 visitors', url: expoPage.url, quote: '15,000 trade visitors expected' },
          dates: { value: '12-14 February 2027', url: 'https://expo.test/other', quote: '12-14 February 2027' },
          prices: [{ label: 'Premium', value: '₹90,000', url: expoPage.url, quote: 'Premium package ₹90,000' }],
        },
      ],
    });
    const out = validateOffers(reply, sites)!;
    expect(out.dropped).toBe(4);
    expect(hasOffers(out.sites[0]!)).toBe(false);
    expect(out.sites[1]).toEqual(emptyOffers('shop.test'));
  });

  it('reads an empty {} fact as not stated, not as a dropped one', () => {
    const reply = JSON.stringify({ sites: [{ domain: 'expo.test', eventName: {}, dates: { value: '', url: '', quote: '' }, stallPrice: null }] });
    const out = validateOffers(reply, sites)!;
    expect(out.dropped).toBe(0);
    expect(out.sites[0]!.eventName).toBeNull();
    expect(out.sites[0]!.dates).toBeNull();
  });

  it('rejects answers that are not the expected JSON', () => {
    expect(validateOffers('not json', sites)).toBeNull();
    expect(validateOffers('{"other":1}', sites)).toBeNull();
  });
});

describe('products and services', () => {
  // Shaped like web.ensis.in: product cards link to /products/…, services are headings, a footer links its solutions.
  const html = `<nav><a href="/products">Products</a><a href="/about-us">About</a></nav>
    <h2>Wellness Spaces That Heal</h2><h3>Complete Room Setups</h3><h4>Panchkarma Suite Setup</h4><h4>Shirodhara Room Setup</h4>
    <a href="/products/premium-teak-wood-ayurvedic-droni-table"><span>PREMIUM TEAK WOOD AYURVEDIC DRONI TABLE</span> Explore Now</a>
    <a href="https://web.ensis.in/products/shirodhara-therapy-table">SHIRODHARA THERAPY TABLE <b>Explore Now</b></a>
    <a href="/products/premium-teak-wood-ayurvedic-droni-table">PREMIUM TEAK WOOD AYURVEDIC DRONI TABLE</a>
    <a href="/blog/spa-trends">Top 7 Spa Trends</a><a href="https://other.com/products/x">Other Site Product</a><a href="/files/brochure.pdf">E-Brochure</a>
    <footer><a href="/solutions/spa-setup">Spa Setup</a><a href="/products">View All</a><a href="/products?all">EXPLORE COLLECTIONS</a><a href="/products">Show More</a></footer>`;

  it('reads catalogue link labels (without button words) and headings from a page', () => {
    const text = catalogueText(html, 'https://web.ensis.in/');
    expect(text).toContain('Product / service links: PREMIUM TEAK WOOD AYURVEDIC DRONI TABLE | SHIRODHARA THERAPY TABLE | Spa Setup');
    expect(text).toContain('Headings: Wellness Spaces That Heal | Complete Room Setups | Panchkarma Suite Setup | Shirodhara Room Setup');
    expect(text).not.toMatch(/Explore Now|Other Site|Spa Trends|E-Brochure|View All|EXPLORE COLLECTIONS|Show More/);
    const [first, second] = siteCatalogue([{ url: 'https://web.ensis.in/', html }, { url: 'https://web.ensis.in/x', html: '<p>nothing</p>' }]);
    expect(first?.url).toBe('https://web.ensis.in/');
    expect(second).toBeUndefined();
  });

  it('keeps named products and services whose quote holds the name, once each', () => {
    const page = { url: 'https://web.ensis.in/', text: `Intro. ${catalogueText(html, 'https://web.ensis.in/')}` };
    const reply = JSON.stringify({
      sites: [
        {
          domain: 'web.ensis.in',
          products: [
            { value: 'PREMIUM TEAK WOOD AYURVEDIC DRONI TABLE', url: page.url, quote: 'PREMIUM TEAK WOOD AYURVEDIC DRONI TABLE' },
            { value: 'Premium Teak Wood Ayurvedic Droni Table', url: page.url, quote: 'PREMIUM TEAK WOOD AYURVEDIC DRONI TABLE | SHIRODHARA' },
            { value: 'Steam Bath Cabinet', url: page.url, quote: 'Steam Bath Cabinet' },
            { value: 'Shirodhara Table', url: page.url, quote: 'SHIRODHARA THERAPY TABLE' },
          ],
          services: [{ value: 'Panchkarma Suite Setup', url: page.url, quote: 'Panchkarma Suite Setup' }],
        },
      ],
    });
    const out = validateOffers(reply, [{ domain: 'web.ensis.in', pages: [page] }])!;
    // The repeat is listed once; the invented product and the name not in its quote are dropped.
    expect(out.sites[0]!.products!.map((p) => p.value)).toEqual(['PREMIUM TEAK WOOD AYURVEDIC DRONI TABLE']);
    expect(out.sites[0]!.services!.map((p) => p.value)).toEqual(['Panchkarma Suite Setup']);
    expect(out.dropped).toBe(2);
    expect(hasOffers(out.sites[0]!)).toBe(true);
  });

  it('keeps a name written on the site even when its quote is a general sentence; drops one that is not', () => {
    const home = { url: 'https://web.ensis.in/', text: 'Leading manufacturer of spa equipment. Product / service links: Hydrotherapy Equipment | Spa Setup' };
    const generic = 'Leading manufacturer of spa equipment.';
    const reply = JSON.stringify({
      sites: [{ domain: 'web.ensis.in', products: [
        { value: 'Hydrotherapy Equipment', url: home.url, quote: generic },
        { value: 'Steam Cabinet', url: home.url, quote: generic },
      ] }],
    });
    const out = validateOffers(reply, [{ domain: 'web.ensis.in', pages: [home] }])!;
    expect(out.sites[0]!.products).toEqual([{ value: 'Hydrotherapy Equipment', url: home.url, quote: 'Hydrotherapy Equipment' }]);
    expect(out.dropped).toBe(1);
  });

  it('lists near-identical names once (plural, hyphens, &)', () => {
    const home = { url: 'https://d.test/', text: 'Retail Interior | Retail Interiors | Shop in Shops | Shop-in-Shops | Display & Merchandising | Display and Merchandising' };
    const item = (value: string) => ({ value, url: home.url, quote: value });
    const reply = JSON.stringify({ sites: [{ domain: 'd.test', services: ['Retail Interior', 'Retail Interiors', 'Shop in Shops', 'Shop-in-Shops', 'Display & Merchandising', 'Display and Merchandising'].map(item) }] });
    const out = validateOffers(reply, [{ domain: 'd.test', pages: [home] }])!;
    expect(out.sites[0]!.services!.map((s) => s.value)).toEqual(['Retail Interior', 'Shop in Shops', 'Display & Merchandising']);
  });

  it('keeps a name quoted from another page of the same site, with the page that has it', () => {
    const home = { url: 'https://web.ensis.in/', text: 'Product / service links: SHIRODHARA THERAPY TABLE | Spa Setup' };
    const list = { url: 'https://web.ensis.in/products', text: 'All products. Aroma Diffuser.' };
    const reply = JSON.stringify({
      sites: [{ domain: 'web.ensis.in', products: [
        { value: 'SHIRODHARA THERAPY TABLE', url: list.url, quote: 'SHIRODHARA THERAPY TABLE' },
        { value: 'Steam Cabinet', url: list.url, quote: 'Steam Cabinet' },
      ] }],
    });
    const out = validateOffers(reply, [{ domain: 'web.ensis.in', pages: [home, list] }])!;
    expect(out.sites[0]!.products).toEqual([{ value: 'SHIRODHARA THERAPY TABLE', url: home.url, quote: 'SHIRODHARA THERAPY TABLE' }]);
    expect(out.dropped).toBe(1);
  });
});

describe('count-up numbers read before they ran', () => {
  it('drops "0+", "0%" and "0" claims but keeps real numbers with a zero in them', () => {
    const page = { url: 'https://d.test/', text: '0+ Happy Clients Trusted partnerships nationwide 0% Client Satisfaction Annual Turnover 0 - 40 L Since 2004 0 Projects' };
    const claim = (label: string, value: string, quote: string) => ({ label, value, url: page.url, quote });
    const reply = JSON.stringify({ sites: [{ domain: 'd.test', claims: [
      claim('clients', '0+', '0+ Happy Clients'),
      claim('client satisfaction', '0%', '0% Client Satisfaction'),
      claim('projects', '0', '0 Projects'),
      claim('Annual Turnover', '0 - 40 L', 'Annual Turnover 0 - 40 L'),
      claim('since', '2004', 'Since 2004'),
    ] }] });
    const out = validateOffers(reply, [{ domain: 'd.test', pages: [page] }])!;
    expect(out.sites[0]!.claims.map((c) => c.value)).toEqual(['0 - 40 L', '2004']);
    expect(out.dropped).toBe(3);
  });
});
