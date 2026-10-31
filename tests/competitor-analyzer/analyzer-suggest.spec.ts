import { describe, expect, it } from 'vitest';
import { locationClues, placeLinks, structuredAddresses } from '../../src/modules/competitor-analyzer/analyzer-evidence';
import { domainFrom, locationUserPrompt, nameMatchesSite, suggestUserPrompt, validateLocation, validateSuggest } from '../../src/modules/competitor-analyzer/analyzer-suggest';

describe('competitor suggestions', () => {
  it('reads plain domains out of what the AI wrote', () => {
    expect(domainFrom('www.Acme.in/about')).toBe('acme.in');
    expect(domainFrom('https://shop.example.co.uk')).toBe('shop.example.co.uk');
    expect(domainFrom('null')).toBeNull();
    expect(domainFrom('not a domain')).toBeNull();
  });

  it('keeps named competitors, drops marketplaces, the client itself and repeated names', () => {
    const answer = validateSuggest(
      JSON.stringify({
        business: { what: 'Organic food trade fair for buyers in India', where: 'New Delhi' },
        area: 'Delhi NCR',
        competitors: [
          { name: 'Organic World Expo', website: 'www.organicworldexpo.com', why: 'Same audience of organic buyers' },
          { name: 'IndiaMart organic', website: 'indiamart.com', why: 'Lists organic suppliers' },
          { name: 'Bharat Organic Expo', website: 'bharatorganicexpo.com', why: 'This is the client' },
          { name: 'organic world expo', website: 'x.com', why: 'Duplicate' },
          { name: 'BioFach India', website: null, why: 'Gets 1 million monthly visits' },
        ],
      }),
      'bharatorganicexpo.com',
    )!;
    expect(answer.business).toEqual({ what: 'Organic food trade fair for buyers in India', where: 'New Delhi' });
    expect(answer.area).toBe('Delhi NCR');
    // IndiaMart keeps its name (the Knowledge Graph check drops marketplaces again); the invented visits claim is cleared.
    expect(answer.candidates).toEqual([
      { name: 'Organic World Expo', website: 'organicworldexpo.com', why: 'Same audience of organic buyers' },
      { name: 'IndiaMart organic', website: null, why: 'Lists organic suppliers' },
      { name: 'BioFach India', website: null, why: '' },
    ]);
  });

  it('rejects answers that are not the expected JSON and labels the prompt with the site', () => {
    expect(validateSuggest('nope', 'a.com')).toBeNull();
    expect(validateSuggest('{"business":{}}', 'a.com')).toBeNull();
    expect(suggestUserPrompt({ domain: 'a.com', title: 'A', description: '', headings: ['Stalls'], text: 'x'.repeat(5000), scope: 'city' })).toContain('Client website: a.com');
  });

  it('tells the AI which area to search and the location the user typed', () => {
    const base = { domain: 'a.com', title: 'A', description: '', headings: [], text: 'x' };
    expect(suggestUserPrompt({ ...base, scope: 'state' })).toContain('Area to search: state');
    expect(suggestUserPrompt({ ...base, scope: 'country' })).toContain('(none, read it from the site)');
    expect(suggestUserPrompt({ ...base, scope: 'city', place: '  Jaipur ' })).toContain('Location given by the user: Jaipur');
    expect(validateSuggest('{"competitors":[]}', 'a.com')!.area).toBeNull();
  });

  it('accepts a website only when it carries the competitor name (real cases from designhouse.co.in)', () => {
    // Right: the name is in the domain or in the site's own name.
    expect(nameMatchesSite('Studio Interplay', 'studiointerplay.com', null)).toBe(true);
    expect(nameMatchesSite('Design Essentials', 'designessentials.co.in', 'Designessentials')).toBe(true);
    expect(nameMatchesSite('Studio Archohm', 'archohm.com', 'welcome to archohm consults')).toBe(true);
    expect(nameMatchesSite('Urban Ladder Interiors', 'urbanladder.com', null)).toBe(true);
    expect(nameMatchesSite('Synergy Corporate Interiors', 'synergyce.com', null)).toBe(true);
    expect(nameMatchesSite('Acme', 'shop.example.in', 'Acme Furniture')).toBe(true);
    // Wrong: a Knowledge Graph search for the name landed on an unrelated big brand.
    expect(nameMatchesSite('Design My Space', 'samsung.com', 'Samsung India')).toBe(false);
    expect(nameMatchesSite('Design Forum International', 'decathlon.com', 'Decathlon')).toBe(false);
    expect(nameMatchesSite('Axiom India', 'mentor.com', 'Siemens')).toBe(false);
    // Only common words: the whole name must appear.
    expect(nameMatchesSite('The Design Studio', 'thedesignstudio.in', null)).toBe(true);
    expect(nameMatchesSite('Design Studio', 'designcafe.com', null)).toBe(false);
  });

  it('keeps each structured address with what it belongs to (venue vs office)', () => {
    const html = `<script type="application/ld+json">{"@graph":[{"@type":"Event","name":"Expo","location":{"@type":"Place","name":"Bharat Mandapam","address":{"@type":"PostalAddress","streetAddress":"Pragati Maidan","addressLocality":"New Delhi","addressRegion":"Delhi","addressCountry":"IN"}}},
      {"@type":"LocalBusiness","name":"Expo HQ","address":{"@type":"PostalAddress","addressLocality":"Ghaziabad","postalCode":"201007"}}]}</script>`;
    expect(structuredAddresses(html)).toEqual(['Place Bharat Mandapam: Pragati Maidan, New Delhi, Delhi, IN', 'LocalBusiness Expo HQ: Ghaziabad, 201007']);
    // Broken JSON-LD still gives the bare fields.
    expect(structuredAddresses('<script type="application/ld+json">{"addressLocality":"Pune",}</script>')).toEqual(['Address fields: addressLocality: Pune']);
  });

  it('reads location clues from a page: address tags, maps, footer, text near place words, phones', () => {
    const html = `<html><body><main><h2>Event Venue</h2><p>Hall No. 12, Pragati Maidan, New Delhi 110001</p><p>Lots of other text about organic food.</p>
      <address>Shop 4, MI Road, Jaipur</address><iframe src="https://www.google.com/maps/embed?pb=!1m18!2sCity+Palace%2C+Jaipur!5e0"></iframe></main>
      <footer class="f"><p>Head Office: Ghaziabad 201007</p><a href="tel:+91 98100 00000">Call</a></footer></body></html>`;
    const clues = locationClues(html);
    expect(clues).toContain('Address tags:\n- Shop 4, MI Road, Jaipur');
    expect(clues).toContain('Embedded map places: City Palace, Jaipur');
    expect(clues).toContain('Footer: Head Office: Ghaziabad 201007 Call');
    expect(clues).toMatch(/Text near place words:\n- .*Event Venue Hall No\. 12, Pragati Maidan, New Delhi 110001/);
    expect(clues).toContain('Phone numbers: +91 98100 00000');
  });

  it('follows contact, location and about links on the same site, contact first', () => {
    const html = `<a href="/about-us">About</a><a href="/our-branches">Branches</a><a href="https://other.com/contact">x</a><a href="/contact">Contact</a><a href="/blog">Blog</a><a href="tel:123">Call</a><a href="/files/brochure.pdf">Venue map</a>`;
    expect(placeLinks(html, new URL('https://www.acme.in/'))).toEqual(['https://www.acme.in/contact', 'https://www.acme.in/our-branches', 'https://www.acme.in/about-us']);
  });

  it('keeps only places the site states, main place first', () => {
    const evidence = 'Footer: Event Venue – Hall No. 12, Pragati Maidan, New Delhi – 110001, India. Head Office – Ghaziabad, Uttar Pradesh, India.';
    const answer = JSON.stringify({
      places: [
        { label: 'Event venue', city: 'New Delhi', state: 'Delhi', country: 'India', quote: 'Hall No. 12, Pragati Maidan, New Delhi – 110001' },
        { label: 'Head office', city: 'Ghaziabad', state: 'Uttar Pradesh', country: 'India', quote: 'Head Office in Ghaziabad' },
        { label: 'Branch', city: 'Mumbai', state: 'Maharashtra', country: 'India', quote: 'Mumbai branch on Linking Road' },
        { label: 'Event venue', city: 'New Delhi', state: 'Delhi', country: 'India', quote: 'Pragati Maidan' },
        { label: 'Nothing', city: 'unknown', state: null, country: null, quote: '' },
      ],
      basis: 'The expo is held at the venue.',
    });
    const location = validateLocation(answer, evidence)!;
    expect(location).toMatchObject({ city: 'New Delhi', state: 'Delhi', country: 'India', basis: 'The expo is held at the venue.' });
    // Ghaziabad is kept (named in the evidence though the quote is paraphrased); Mumbai is not on the site; the repeat is dropped.
    expect(location.places.map((p) => p.city)).toEqual(['New Delhi', 'Ghaziabad']);
    expect(validateLocation('{"places":[]}', evidence)).toEqual({ city: null, state: null, country: null, basis: '', places: [] });
    expect(validateLocation('nope', evidence)).toBeNull();
    expect(validateLocation('{"city":"Jaipur"}', evidence)).toBeNull();
    expect(locationUserPrompt({ domain: 'a.com', title: 'A', description: '', text: 'x', clues: 'Footer: Jaipur' })).toContain('Location clues:\nFooter: Jaipur');
  });
});
