import { createHash } from 'node:crypto';
import { Resolver } from 'node:dns/promises';

export interface DnsRecords {
  A: string[];
  AAAA: string[];
  MX: Array<{ priority: number; exchange: string }>;
  NS: string[];
  CNAME: string[];
  TXT: string[];
  CAA: Array<{ critical: number; tag: string; value: string }>;
  SOA: { nsname: string; hostmaster: string; serial: number; refresh: number; retry: number; expire: number; minttl: number } | null;
  DMARC?: string[];
}

export interface DnsLookupResult {
  records: DnsRecords;
  errors: Record<string, string>;
}

export interface DnsChange {
  type: keyof DnsRecords;
  added: string[];
  removed: string[];
}

export const EMPTY_RECORDS: DnsRecords = { A: [], AAAA: [], MX: [], NS: [], CNAME: [], TXT: [], CAA: [], SOA: null, DMARC: [] };

const NO_DATA = new Set(['ENODATA', 'ENOTFOUND', 'NODATA', 'NXDOMAIN']);

export interface DnsResolverLike {
  resolve4(h: string): Promise<string[]>;
  resolve6(h: string): Promise<string[]>;
  resolveMx(h: string): Promise<Array<{ priority: number; exchange: string }>>;
  resolveNs(h: string): Promise<string[]>;
  resolveCname(h: string): Promise<string[]>;
  resolveTxt(h: string): Promise<string[][]>;
  resolveCaa(h: string): Promise<Array<Record<string, unknown>>>;
  resolveSoa(h: string): Promise<DnsRecords['SOA'] & object>;
}
export const DEFAULT_DNS_SERVERS = ['1.1.1.1', '8.8.8.8', '9.9.9.9'];

export function defaultResolver(timeoutMs = 5000): DnsResolverLike {
  const r = new Resolver({ timeout: timeoutMs, tries: 2 });
  const configured = (process.env.INFRA_DNS_SERVERS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  try {
    r.setServers(configured.length ? configured : DEFAULT_DNS_SERVERS);
  } catch {
    r.setServers(DEFAULT_DNS_SERVERS);
  }
  return r as unknown as DnsResolverLike;
}

async function attempt<T>(type: string, errors: Record<string, string>, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code ?? '';
    if (!NO_DATA.has(code)) errors[type] = (code || (e instanceof Error ? e.message : 'lookup failed')).slice(0, 80);
    return fallback;
  }
}

export async function lookupDns(hostname: string, resolver: DnsResolverLike = defaultResolver()): Promise<DnsLookupResult> {
  const errors: Record<string, string> = {};
  const [A, AAAA, MX, NS, CNAME, TXT, CAA, SOA, DMARC] = await Promise.all([
    attempt('A', errors, () => resolver.resolve4(hostname), [] as string[]),
    attempt('AAAA', errors, () => resolver.resolve6(hostname), [] as string[]),
    attempt('MX', errors, () => resolver.resolveMx(hostname), [] as Array<{ priority: number; exchange: string }>),
    attempt('NS', errors, () => resolver.resolveNs(hostname), [] as string[]),
    attempt('CNAME', errors, () => resolver.resolveCname(hostname), [] as string[]),
    attempt('TXT', errors, () => resolver.resolveTxt(hostname), [] as string[][]),
    attempt('CAA', errors, () => resolver.resolveCaa(hostname), [] as Array<Record<string, unknown>>),
    attempt('SOA', errors, () => resolver.resolveSoa(hostname) as Promise<DnsRecords['SOA']>, null as DnsRecords['SOA']),
    attempt('DMARC', errors, () => resolver.resolveTxt(`_dmarc.${hostname}`), [] as string[][]),
  ]);
  return {
    errors,
    records: {
      A: [...A].sort(),
      AAAA: [...AAAA].map((v) => v.toLowerCase()).sort(),
      MX: [...MX].map((m) => ({ priority: m.priority, exchange: m.exchange.toLowerCase() })).sort((a, b) => a.priority - b.priority || a.exchange.localeCompare(b.exchange)),
      NS: [...NS].map((v) => v.toLowerCase()).sort(),
      CNAME: [...CNAME].map((v) => v.toLowerCase()).sort(),
      TXT: TXT.map((chunks) => chunks.join('')).sort(),
      CAA: CAA.map((c) => {
        const tag = ['issue', 'issuewild', 'iodef'].find((t) => t in c) ?? 'unknown';
        return { critical: Number(c.critical ?? 0), tag, value: String(c[tag] ?? '') };
      }).sort((a, b) => a.tag.localeCompare(b.tag) || a.value.localeCompare(b.value)),
      DMARC: DMARC.map((chunks) => chunks.join('')).filter((v) => v.toLowerCase().startsWith('v=dmarc1')).sort(),
      SOA: SOA ? { nsname: SOA.nsname, hostmaster: SOA.hostmaster, serial: SOA.serial, refresh: SOA.refresh, retry: SOA.retry, expire: SOA.expire, minttl: SOA.minttl } : null,
    },
  };
}

function flatten(records: DnsRecords): Record<keyof DnsRecords, string[]> {
  return {
    DMARC: records.DMARC ?? [],
    A: records.A,
    AAAA: records.AAAA,
    MX: records.MX.map((m) => `${m.priority} ${m.exchange}`),
    NS: records.NS,
    CNAME: records.CNAME,
    TXT: records.TXT,
    CAA: records.CAA.map((c) => `${c.critical} ${c.tag} ${c.value}`),
    SOA: records.SOA ? [`${records.SOA.nsname} ${records.SOA.hostmaster}`] : [],
  };
}
export function diffRecords(previous: DnsRecords, next: DnsRecords, skip: Iterable<string> = []): DnsChange[] {
  const skipped = new Set(skip);
  const a = flatten(previous);
  const b = flatten(next);
  const out: DnsChange[] = [];
  for (const type of Object.keys(a) as Array<keyof DnsRecords>) {
    if (skipped.has(type)) continue;
    if (type === 'DMARC' && previous.DMARC === undefined) continue;
    const before = new Set(a[type]);
    const after = new Set(b[type]);
    const added = [...after].filter((v) => !before.has(v)).sort();
    const removed = [...before].filter((v) => !after.has(v)).sort();
    if (added.length || removed.length) out.push({ type, added, removed });
  }
  return out;
}

export function hashRecords(records: DnsRecords): string {
  const flat = flatten(records);
  return createHash('sha256').update(JSON.stringify(Object.keys(flat).sort().map((k) => [k, flat[k as keyof DnsRecords]]))).digest('hex');
}

export function describeTxt(value: string): string {
  const v = value.toLowerCase();
  if (v.startsWith('v=spf1')) return 'SPF policy (hidden)';
  if (v.startsWith('v=dkim1')) return 'DKIM key (hidden)';
  if (v.startsWith('v=dmarc1')) return 'DMARC policy (hidden)';
  if (/verification|verify|site-verif|ms=|atlassian|stripe|facebook-domain|apple-domain|_acme|token/.test(v)) return 'Verification token (hidden)';
  return 'TXT record (hidden)';
}

export function redactForViewer(records: DnsRecords, canSeeSensitive: boolean): DnsRecords & { txtRedacted: boolean } {
  return { ...records, TXT: canSeeSensitive ? records.TXT : records.TXT.map(describeTxt), DMARC: canSeeSensitive ? records.DMARC : (records.DMARC ?? []).map(describeTxt), txtRedacted: !canSeeSensitive };
}

export function summarizeChanges(changes: DnsChange[]): string {
  return changes
    .map((c) => (c.type === 'TXT' ? `TXT: ${c.added.length} added, ${c.removed.length} removed` : `${c.type}: ${c.added.length} added, ${c.removed.length} removed`))
    .join('; ');
}

export interface EmailPosture {
  spf: { present: boolean; qualifier: 'fail' | 'softfail' | 'neutral' | 'pass' | 'none' | null };
  dmarc: { present: boolean | null; policy: 'none' | 'quarantine' | 'reject' | null };
  caa: { present: boolean; issuers: number };
  mx: { present: boolean };
  dkim: { checked: false; note: string };
}
export function emailPosture(records: DnsRecords): EmailPosture {
  const spfRecord = records.TXT.map((t) => t.toLowerCase()).find((t) => t.startsWith('v=spf1'));
  const all = spfRecord ? /\s([-~?+]?)all\b/.exec(spfRecord)?.[1] : undefined;
  const dmarcRecord = (records.DMARC ?? [])[0]?.toLowerCase();
  const policy = dmarcRecord ? /(?:^|;)\s*p=(none|quarantine|reject)/.exec(dmarcRecord)?.[1] : undefined;
  return {
    spf: { present: Boolean(spfRecord), qualifier: !spfRecord ? 'none' : all === '-' ? 'fail' : all === '~' ? 'softfail' : all === '?' ? 'neutral' : all === '' || all === '+' ? 'pass' : null },
    dmarc: { present: records.DMARC === undefined ? null : Boolean(dmarcRecord), policy: (policy as 'none' | 'quarantine' | 'reject' | undefined) ?? null },
    caa: { present: records.CAA.length > 0, issuers: records.CAA.filter((c) => c.tag === 'issue' || c.tag === 'issuewild').length },
    mx: { present: records.MX.length > 0 },
    dkim: { checked: false, note: 'DKIM selectors cannot be discovered automatically. Add a selector to check it.' },
  };
}
