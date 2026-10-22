import { safeFetch, type SafeFetchDeps } from './safe-fetch';

export const RDAP_BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';

export type RdapState = 'OK' | 'NO_EXPIRY' | 'NOT_FOUND' | 'UNSUPPORTED' | 'RESTRICTED' | 'RATE_LIMITED' | 'ERROR';

export interface RdapBootstrap {
  services: Array<[string[], string[]]>;
}

export interface ParsedRdap {
  registrar: string | null;
  registeredAt: Date | null;
  registryExpiresAt: Date | null;
  registrarExpiresAt: Date | null;
  lastChangedAt: Date | null;
  statuses: string[];
  nameservers: string[];
  dnssec: boolean | null;
}

export interface RdapLookup {
  state: RdapState;
  source: string | null;
  parsed: ParsedRdap | null;
  error: string | null;
}

export function pickRdapServer(bootstrap: RdapBootstrap, tld: string): string | null {
  const wanted = tld.toLowerCase();
  for (const [tlds, urls] of bootstrap.services ?? []) {
    if (tlds.some((t) => t.toLowerCase() === wanted) && urls.length) {
      return urls.find((u) => u.startsWith('https://')) ?? null;
    }
  }
  return null;
}

type RdapEvent = { eventAction?: string; eventDate?: string };

function eventDate(events: RdapEvent[] | undefined, ...actions: string[]): Date | null {
  for (const action of actions) {
    const hit = events?.find((e) => e.eventAction?.toLowerCase() === action && e.eventDate);
    if (hit?.eventDate) {
      const d = new Date(hit.eventDate);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function registrarOf(entities: Array<Record<string, unknown>> | undefined): { name: string | null; expiresAt: Date | null } {
  const entity = (entities ?? []).find((e) => Array.isArray(e.roles) && (e.roles as string[]).includes('registrar'));
  if (!entity) return { name: null, expiresAt: null };
  let name: string | null = null;
  const vcard = entity.vcardArray as unknown[] | undefined;
  const props = Array.isArray(vcard) && Array.isArray(vcard[1]) ? (vcard[1] as unknown[][]) : [];
  const fn = props.find((p) => p[0] === 'fn');
  if (fn && typeof fn[3] === 'string') name = fn[3];
  if (!name) {
    const ids = entity.publicIds as Array<{ identifier?: string }> | undefined;
    if (ids?.[0]?.identifier) name = `IANA registrar ${ids[0].identifier}`;
  }
  return { name: name?.slice(0, 200) ?? null, expiresAt: eventDate(entity.events as RdapEvent[] | undefined, 'expiration') };
}

export function parseRdapDomain(json: unknown): ParsedRdap {
  const doc = (json ?? {}) as Record<string, unknown>;
  const events = doc.events as RdapEvent[] | undefined;
  const registrar = registrarOf(doc.entities as Array<Record<string, unknown>> | undefined);
  const ns = (doc.nameservers as Array<{ ldhName?: string }> | undefined) ?? [];
  const secure = doc.secureDNS as { delegationSigned?: boolean } | undefined;
  return {
    registrar: registrar.name,
    registeredAt: eventDate(events, 'registration'),
    registryExpiresAt: eventDate(events, 'expiration'),
    registrarExpiresAt: registrar.expiresAt,
    lastChangedAt: eventDate(events, 'last changed'),
    statuses: Array.isArray(doc.status) ? (doc.status as unknown[]).filter((s): s is string => typeof s === 'string').slice(0, 20) : [],
    nameservers: [...new Set(ns.map((n) => n.ldhName?.toLowerCase()).filter((n): n is string => Boolean(n)))].sort().slice(0, 20),
    dnssec: typeof secure?.delegationSigned === 'boolean' ? secure.delegationSigned : null,
  };
}

let bootstrapCache: { at: number; value: RdapBootstrap } | null = null;
const BOOTSTRAP_TTL_MS = 24 * 3_600_000;

export async function loadBootstrap(deps: SafeFetchDeps = {}, now = Date.now()): Promise<RdapBootstrap> {
  if (bootstrapCache && now - bootstrapCache.at < BOOTSTRAP_TTL_MS) return bootstrapCache.value;
  const res = await safeFetch(RDAP_BOOTSTRAP_URL, { timeoutMs: 10_000, maxBytes: 1_000_000, headers: { accept: 'application/json' } }, deps);
  if (!res.ok) throw new Error(`RDAP bootstrap returned HTTP ${res.status}`);
  const value = JSON.parse(res.body) as RdapBootstrap;
  if (!Array.isArray(value.services)) throw new Error('RDAP bootstrap had an unexpected shape');
  bootstrapCache = { at: now, value };
  return value;
}

export function resetRdapBootstrapCache(): void {
  bootstrapCache = null;
}

export async function lookupDomain(ascii: string, tld: string, deps: SafeFetchDeps & { bootstrap?: RdapBootstrap } = {}): Promise<RdapLookup> {
  let bootstrap: RdapBootstrap;
  try {
    bootstrap = deps.bootstrap ?? (await loadBootstrap(deps));
  } catch (e) {
    return { state: 'ERROR', source: null, parsed: null, error: `RDAP service discovery failed: ${e instanceof Error ? e.message : 'unknown error'}`.slice(0, 300) };
  }
  const server = pickRdapServer(bootstrap, tld);
  if (!server) return { state: 'UNSUPPORTED', source: null, parsed: null, error: `No public RDAP service is published for .${tld}.` };
  const url = `${server.replace(/\/+$/, '')}/domain/${encodeURIComponent(ascii)}`;
  try {
    const res = await safeFetch(url, { timeoutMs: 12_000, maxBytes: 1_000_000, headers: { accept: 'application/rdap+json, application/json' } }, deps);
    if (res.status === 404) return { state: 'NOT_FOUND', source: server, parsed: null, error: 'The registry has no record of this name (not registered, or not a registrable domain).' };
    if (res.status === 429) return { state: 'RATE_LIMITED', source: server, parsed: null, error: 'The registry rate-limited this lookup. It will be retried.' };
    if (res.status === 401 || res.status === 403) return { state: 'RESTRICTED', source: server, parsed: null, error: 'The registry restricts RDAP data for this domain.' };
    if (!res.ok) return { state: 'ERROR', source: server, parsed: null, error: `The registry answered HTTP ${res.status}.` };
    const parsed = parseRdapDomain(JSON.parse(res.body));
    if (!parsed.registryExpiresAt && !parsed.registrarExpiresAt) {
      return { state: 'NO_EXPIRY', source: server, parsed, error: 'The registry did not publish an expiration date for this domain.' };
    }
    return { state: 'OK', source: server, parsed, error: null };
  } catch (e) {
    return { state: 'ERROR', source: server, parsed: null, error: `RDAP lookup failed: ${e instanceof Error ? e.message : 'unknown error'}`.slice(0, 300) };
  }
}
