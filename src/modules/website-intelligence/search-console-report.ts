import { classifyGoogleError, googleEndpoint, googleFetch, type GoogleFailure } from './website-google';

export const SEARCH_PERIODS = { '7d': 7, '28d': 28, '3m': 90, '6m': 180, '12m': 365, '16m': 486 } as const;
export type SearchPeriod = keyof typeof SEARCH_PERIODS;
const RETENTION_DAYS = 486;

export function parsePeriod(value: unknown): SearchPeriod {
  return typeof value === 'string' && value in SEARCH_PERIODS ? (value as SearchPeriod) : '28d';
}

export interface Metrics { clicks: number; impressions: number; ctr: number; position: number }
export interface QueryRow extends Metrics { query: string; previousPosition: number | null; previousClicks: number | null; page: string | null }
export interface SearchConsoleReport {
  property: string;
  period: SearchPeriod;
  range: { start: string; end: string };
  previousRange: { start: string; end: string } | null;
  fetchedAt: string;
  totals: Metrics;
  previous: Metrics | null;
  deltas: { clicks: number | null; impressions: number | null; ctr: number | null; position: number | null };
  trend: (Metrics & { date: string })[];
  queries: QueryRow[];
  pages: (Metrics & { page: string })[];
  countries: { country: string; countryName: string; clicks: number; impressions: number; ctr: number; position: number }[];
  devices: { device: string; clicks: number; impressions: number; ctr: number; position: number }[];
  sitemaps: { submitted: number; indexed: number; pending: number; error: number; warning: number; items: { path: string; lastDownloaded: string | null; isPending: boolean; errors: number; warnings: number; submittedUrls: number | null }[] } | null;
  indexCoverage: null;
  partial: string[] | null;
}

export type ReportResult = { ok: true; data: SearchConsoleReport } | GoogleFailure;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const metrics = (r: any): Metrics => ({ clicks: Number(r?.clicks ?? 0), impressions: Number(r?.impressions ?? 0), ctr: Number(r?.ctr ?? 0) * 100, position: Number(r?.position ?? 0) });
const pct = (cur: number, prior: number) => (prior ? Math.round(((cur - prior) / prior) * 1000) / 10 : null);
const key = (q: unknown) => String(q ?? '').trim().toLowerCase();

export function periodRange(period: SearchPeriod, now = new Date()) {
  const days = SEARCH_PERIODS[period];
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  if (days * 2 > RETENTION_DAYS) return { start, end, previous: null };
  const prevEnd = new Date(start);
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevStart.getUTCDate() - (days - 1));
  return { start, end, previous: { start: prevStart, end: prevEnd } };
}

type Fetcher = typeof fetch;

async function analytics(property: string, token: string, body: Record<string, unknown>, fetcher?: Fetcher) {
  const url = `${googleEndpoint('searchConsole')}/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`;
  const response = await googleFetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ dataState: 'final', ...body }) }, 25_000, fetcher);
  if (!response.ok) return response;
  if (!response.httpOk) return classifyGoogleError('Search Console', response.status, response.body);
  return { ok: true as const, rows: (response.body?.rows ?? []) as any[] };
}

async function sitemapList(property: string, token: string, fetcher?: Fetcher): Promise<SearchConsoleReport['sitemaps']> {
  const response = await googleFetch(`${googleEndpoint('searchConsole')}/webmasters/v3/sites/${encodeURIComponent(property)}/sitemaps`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } }, 15_000, fetcher);
  if (!response.ok || !response.httpOk) return null;
  const list: any[] = Array.isArray(response.body?.sitemap) ? response.body.sitemap : [];
  const items = list.map((s) => ({
    path: String(s.path ?? ''),
    lastDownloaded: typeof s.lastDownloaded === 'string' ? s.lastDownloaded : null,
    isPending: s.isPending === true,
    errors: Number(s.errors ?? 0),
    warnings: Number(s.warnings ?? 0),
    submittedUrls: Array.isArray(s.contents) ? s.contents.reduce((sum: number, c: any) => sum + Number(c?.submitted ?? 0), 0) : null,
  }));
  return {
    submitted: items.length,
    indexed: items.filter((s) => !s.isPending && s.errors === 0).length,
    pending: items.filter((s) => s.isPending).length,
    error: items.filter((s) => s.errors > 0).length,
    warning: items.filter((s) => s.warnings > 0).length,
    items,
  };
}

export async function searchConsoleReport(args: { property: string; token: string; period: SearchPeriod; now?: Date; fetcher?: Fetcher }): Promise<ReportResult> {
  const { property, token, period, fetcher } = args;
  const { start, end, previous } = periodRange(period, args.now);
  const window = { startDate: iso(start), endDate: iso(end) };

  // The sitewide total proves the property is readable; any failure there is the answer.
  const totalsRes = await analytics(property, token, window, fetcher);
  if (!totalsRes.ok) return totalsRes;

  const partial: string[] = [];
  const rowsOf = (label: string, res: Awaited<ReturnType<typeof analytics>> | null) => {
    if (!res) return [];
    if (!res.ok) {
      partial.push(`${label}: ${res.message}`);
      return [];
    }
    return res.rows;
  };
  const prevWindow = previous ? { startDate: iso(previous.start), endDate: iso(previous.end) } : null;
  const [prevTotals, trend, queries, prevQueries, queryPages, pages, countries, devices, sitemaps] = await Promise.all([
    prevWindow ? analytics(property, token, prevWindow, fetcher) : Promise.resolve(null),
    analytics(property, token, { ...window, dimensions: ['date'], rowLimit: 500 }, fetcher),
    analytics(property, token, { ...window, dimensions: ['query'], rowLimit: 1000 }, fetcher),
    prevWindow ? analytics(property, token, { ...prevWindow, dimensions: ['query'], rowLimit: 1000 }, fetcher) : Promise.resolve(null),
    analytics(property, token, { ...window, dimensions: ['query', 'page'], rowLimit: 5000 }, fetcher),
    analytics(property, token, { ...window, dimensions: ['page'], rowLimit: 1000 }, fetcher),
    analytics(property, token, { ...window, dimensions: ['country'], rowLimit: 250 }, fetcher),
    analytics(property, token, { ...window, dimensions: ['device'], rowLimit: 10 }, fetcher),
    sitemapList(property, token, fetcher),
  ]);

  const totals = metrics(totalsRes.rows[0]);
  const prevRows = rowsOf('previous period', prevTotals);
  // An empty previous window (site not yet in Search Console then) is "no data", never zeros to compare with.
  const prev = prevWindow && prevTotals?.ok && prevRows.length ? metrics(prevRows[0]) : null;

  const previousByQuery = new Map<string, Metrics>();
  for (const r of rowsOf('previous queries', prevQueries)) previousByQuery.set(key(r.keys?.[0]), metrics(r));
  // The landing page a query sends most clicks to (then most impressions).
  const topPage = new Map<string, { page: string; clicks: number; impressions: number }>();
  for (const r of rowsOf('query pages', queryPages)) {
    const q = key(r.keys?.[0]);
    const candidate = { page: String(r.keys?.[1] ?? ''), clicks: Number(r.clicks ?? 0), impressions: Number(r.impressions ?? 0) };
    const best = topPage.get(q);
    if (!best || candidate.clicks > best.clicks || (candidate.clicks === best.clicks && candidate.impressions > best.impressions)) topPage.set(q, candidate);
  }

  return {
    ok: true,
    data: {
      property,
      period,
      range: { start: window.startDate, end: window.endDate },
      previousRange: prevWindow ? { start: prevWindow.startDate, end: prevWindow.endDate } : null,
      fetchedAt: new Date().toISOString(),
      totals,
      previous: prev,
      deltas: prev
        ? { clicks: pct(totals.clicks, prev.clicks), impressions: pct(totals.impressions, prev.impressions), ctr: Math.round((totals.ctr - prev.ctr) * 100) / 100, position: Math.round((totals.position - prev.position) * 100) / 100 }
        : { clicks: null, impressions: null, ctr: null, position: null },
      trend: rowsOf('trend', trend).map((r) => ({ date: `${String(r.keys?.[0] ?? '')}T00:00:00.000Z`, ...metrics(r) })).sort((a, b) => a.date.localeCompare(b.date)),
      queries: rowsOf('queries', queries).map((r) => {
        const q = String(r.keys?.[0] ?? '');
        const before = previousByQuery.get(key(q));
        return { query: q, ...metrics(r), previousPosition: before ? before.position : null, previousClicks: before ? before.clicks : null, page: topPage.get(key(q))?.page ?? null };
      }),
      pages: rowsOf('pages', pages).map((r) => ({ page: String(r.keys?.[0] ?? ''), ...metrics(r) })),
      countries: rowsOf('countries', countries)
        .map((r) => ({ country: String(r.keys?.[0] ?? ''), countryName: countryName(String(r.keys?.[0] ?? '')), ...metrics(r) }))
        .filter((c) => c.impressions > 0),
      devices: rowsOf('devices', devices).map((r) => ({ device: String(r.keys?.[0] ?? ''), ...metrics(r) })),
      sitemaps,
      indexCoverage: null,
      partial: partial.length ? partial : null,
    },
  };
}

export interface QueryDetail {
  query: string;
  period: SearchPeriod;
  range: { start: string; end: string };
  totals: Metrics | null;
  previous: Metrics | null;
  daily: (Metrics & { date: string })[];
  pages: (Metrics & { page: string })[];
  devices: (Metrics & { device: string })[];
  countries: (Metrics & { country: string; countryName: string })[];
}

/** One query's daily clicks / impressions / position, and the pages that rank for it. */
export async function searchQueryDetail(args: { property: string; token: string; query: string; period: SearchPeriod; now?: Date; fetcher?: Fetcher }): Promise<{ ok: true; data: QueryDetail } | GoogleFailure> {
  const { property, token, query, period, fetcher } = args;
  const { start, end, previous } = periodRange(period, args.now);
  const filter = { dimensionFilterGroups: [{ groupType: 'and', filters: [{ dimension: 'query', operator: 'equals', expression: query }] }] };
  const window = { startDate: iso(start), endDate: iso(end), ...filter };
  const [totals, prev, daily, pages, devices, countries] = await Promise.all([
    analytics(property, token, window, fetcher),
    previous ? analytics(property, token, { startDate: iso(previous.start), endDate: iso(previous.end), ...filter }, fetcher) : Promise.resolve(null),
    analytics(property, token, { ...window, dimensions: ['date'], rowLimit: 500 }, fetcher),
    analytics(property, token, { ...window, dimensions: ['page'], rowLimit: 25 }, fetcher),
    analytics(property, token, { ...window, dimensions: ['device'], rowLimit: 10 }, fetcher),
    analytics(property, token, { ...window, dimensions: ['country'], rowLimit: 10 }, fetcher),
  ]);
  const failed = [totals, prev, daily, pages, devices, countries].find((r) => r && !r.ok);
  if (failed && !failed.ok) return failed;
  const rows = (r: typeof totals | null) => (r && r.ok ? r.rows : []);
  return {
    ok: true,
    data: {
      query,
      period,
      range: { start: iso(start), end: iso(end) },
      totals: rows(totals).length ? metrics(rows(totals)[0]) : null,
      previous: rows(prev).length ? metrics(rows(prev)[0]) : null,
      daily: rows(daily).map((r) => ({ date: `${String(r.keys?.[0] ?? '')}T00:00:00.000Z`, ...metrics(r) })).sort((a, b) => a.date.localeCompare(b.date)),
      pages: rows(pages).map((r) => ({ page: String(r.keys?.[0] ?? ''), ...metrics(r) })),
      devices: rows(devices).map((r) => ({ device: String(r.keys?.[0] ?? ''), ...metrics(r) })),
      countries: rows(countries).map((r) => ({ country: String(r.keys?.[0] ?? ''), countryName: countryName(String(r.keys?.[0] ?? '')), ...metrics(r) })),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Country names                                                       */
/* ------------------------------------------------------------------ */

// Search Console reports ISO 3166-1 alpha-3 codes; Intl names countries from alpha-2.
const ALPHA3_TO_2: Record<string, string> = Object.fromEntries(
  ('afg:af ala:ax alb:al dza:dz asm:as and:ad ago:ao aia:ai ata:aq atg:ag arg:ar arm:am abw:aw aus:au aut:at aze:az bhs:bs bhr:bh bgd:bd brb:bb blr:by bel:be blz:bz ben:bj bmu:bm btn:bt ' +
    'bol:bo bes:bq bih:ba bwa:bw bvt:bv bra:br iot:io brn:bn bgr:bg bfa:bf bdi:bi cpv:cv khm:kh cmr:cm can:ca cym:ky caf:cf tcd:td chl:cl chn:cn cxr:cx cck:cc col:co com:km cog:cg cod:cd ' +
    'cok:ck cri:cr civ:ci hrv:hr cub:cu cuw:cw cyp:cy cze:cz dnk:dk dji:dj dma:dm dom:do ecu:ec egy:eg slv:sv gnq:gq eri:er est:ee swz:sz eth:et flk:fk fro:fo fji:fj fin:fi fra:fr guf:gf ' +
    'pyf:pf atf:tf gab:ga gmb:gm geo:ge deu:de gha:gh gib:gi grc:gr grl:gl grd:gd glp:gp gum:gu gtm:gt ggy:gg gin:gn gnb:gw guy:gy hti:ht hmd:hm vat:va hnd:hn hkg:hk hun:hu isl:is ind:in ' +
    'idn:id irn:ir irq:iq irl:ie imn:im isr:il ita:it jam:jm jpn:jp jey:je jor:jo kaz:kz ken:ke kir:ki prk:kp kor:kr kwt:kw kgz:kg lao:la lva:lv lbn:lb lso:ls lbr:lr lby:ly lie:li ltu:lt ' +
    'lux:lu mac:mo mdg:mg mwi:mw mys:my mdv:mv mli:ml mlt:mt mhl:mh mtq:mq mrt:mr mus:mu myt:yt mex:mx fsm:fm mda:md mco:mc mng:mn mne:me msr:ms mar:ma moz:mz mmr:mm nam:na nru:nr npl:np ' +
    'nld:nl ncl:nc nzl:nz nic:ni ner:ne nga:ng niu:nu nfk:nf mkd:mk mnp:mp nor:no omn:om pak:pk plw:pw pse:ps pan:pa png:pg pry:py per:pe phl:ph pcn:pn pol:pl prt:pt pri:pr qat:qa reu:re ' +
    'rou:ro rus:ru rwa:rw blm:bl shn:sh kna:kn lca:lc maf:mf spm:pm vct:vc wsm:ws smr:sm stp:st sau:sa sen:sn srb:rs syc:sc sle:sl sgp:sg sxm:sx svk:sk svn:si slb:sb som:so zaf:za sgs:gs ' +
    'ssd:ss esp:es lka:lk sdn:sd sur:sr sjm:sj swe:se che:ch syr:sy twn:tw tjk:tj tza:tz tha:th tls:tl tgo:tg tkl:tk ton:to tto:tt tun:tn tur:tr tkm:tm tca:tc tuv:tv uga:ug ukr:ua are:ae ' +
    'gbr:gb usa:us umi:um ury:uy uzb:uz vut:vu ven:ve vnm:vn vgb:vg vir:vi wlf:wf esh:eh yem:ye zmb:zm zwe:zw xkx:xk')
    .split(' ')
    .map((pair) => pair.split(':') as [string, string]),
);
let displayNames: Intl.DisplayNames | null | undefined;

export function countryName(alpha3: string): string {
  const code = ALPHA3_TO_2[alpha3.toLowerCase()];
  if (!code) return alpha3.toUpperCase() || 'Unknown';
  if (displayNames === undefined) {
    try {
      displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
      displayNames = null;
    }
  }
  return displayNames?.of(code.toUpperCase()) ?? alpha3.toUpperCase();
}
