import { describe, expect, it, vi } from 'vitest';
import { addMonths, cycleMonths, daysBetween, dueBucket, monthlyEquivalent, nextCycleDate, projectOccurrences, sumMoney, utcDate } from '../../src/modules/infrastructure/core/billing-math';
import { dedupeKey, evaluateThreshold, sanitizeThresholds, severityFor } from '../../src/modules/infrastructure/core/alert-rules';
import { normalizeDomain } from '../../src/modules/infrastructure/core/domain-name';
import { parseRdapDomain, pickRdapServer, lookupDomain } from '../../src/modules/infrastructure/core/rdap';
import { describeTxt, diffRecords, hashRecords, lookupDns, redactForViewer, EMPTY_RECORDS, type DnsRecords, type DnsResolverLike } from '../../src/modules/infrastructure/core/dns-intel';
import { assertProbeTarget, certificateState, parsePeerCertificate, probeCertificate } from '../../src/modules/infrastructure/core/ssl-intel';
import { ContaboAdapter, mapContaboInstance } from '../../src/modules/infrastructure/core/providers/contabo.adapter';
import { ProviderError } from '../../src/modules/infrastructure/core/providers/provider.types';
import { ProviderRegistry } from '../../src/modules/infrastructure/core/providers/registry';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const iso = (x: Date | null) => x?.toISOString().slice(0, 10);

describe('billing recurrence (calendar aware)', () => {
  it('clamps month-end: 31 Jan + 1 month is the last day of February, in common and leap years', () => {
    expect(iso(addMonths(d('2027-01-31'), 1))).toBe('2027-02-28');
    expect(iso(addMonths(d('2028-01-31'), 1))).toBe('2028-02-29');
  });
  it('does not drift when an anchor day is supplied', () => {
    const feb = nextCycleDate(d('2027-01-31'), 'MONTHLY', null, 31)!;
    expect(iso(feb)).toBe('2027-02-28');
    expect(iso(nextCycleDate(feb, 'MONTHLY', null, 31))).toBe('2027-03-31');
    expect(iso(nextCycleDate(feb, 'MONTHLY'))).toBe('2027-03-28'); // without the anchor the series drifts
  });
  it('handles 29 Feb yearly: 28 Feb in common years, 29 Feb again in leap years', () => {
    expect(iso(addMonths(d('2028-02-29'), 12, 29))).toBe('2029-02-28');
    expect(iso(addMonths(d('2028-02-29'), 48, 29))).toBe('2032-02-29');
  });
  it('crosses year boundaries and supports quarterly, half-yearly and custom cycles', () => {
    expect(iso(nextCycleDate(d('2026-11-15'), 'QUARTERLY'))).toBe('2027-02-15');
    expect(iso(nextCycleDate(d('2026-08-31'), 'HALF_YEARLY'))).toBe('2027-02-28');
    expect(iso(nextCycleDate(d('2026-10-01'), 'CUSTOM', 5))).toBe('2027-03-01');
    expect(nextCycleDate(d('2026-10-01'), 'CUSTOM', null)).toBeNull();
    expect(cycleMonths('CUSTOM', 0)).toBeNull();
  });
  it('computes monthly equivalents without float noise', () => {
    expect(monthlyEquivalent(120, 'YEARLY')).toBe(10);
    expect(monthlyEquivalent(100, 'QUARTERLY')).toBe(33.33);
    expect(monthlyEquivalent(null, 'MONTHLY')).toBeNull();
    expect(sumMoney([0.1, 0.2, null, 0.3])).toBe(0.6);
  });
  it('projects occurrences inside a window and buckets days remaining', () => {
    const out = projectOccurrences(d('2026-11-30'), 'MONTHLY', null, d('2026-11-01'), d('2027-03-01'), 30);
    expect(out.map(iso)).toEqual(['2026-11-30', '2026-12-30', '2027-01-30', '2027-02-28']);
    expect(daysBetween(d('2026-10-15'), d('2026-10-22'))).toBe(7);
    expect([dueBucket(-1), dueBucket(0), dueBucket(7), dueBucket(30), dueBucket(91)]).toEqual(['overdue', 'today', 'within7', 'within30', 'later']);
  });
  it('only treats a custom cycle with a positive integer interval as valid', () => {
    expect(utcDate(2026, 0, 1).getUTCDate()).toBe(1);
    expect(cycleMonths('CUSTOM', 1.5)).toBeNull();
  });
});

describe('renewal alert thresholds', () => {
  const now = new Date('2026-10-15T09:30:00.000Z');
  it('fires the tightest threshold that has been reached, never a burst', () => {
    expect(evaluateThreshold(d('2026-11-14'), now)).toMatchObject({ type: 'upcoming', threshold: 30, daysRemaining: 30 });
    expect(evaluateThreshold(d('2026-10-20'), now)).toMatchObject({ type: 'upcoming', threshold: 7 });
    expect(evaluateThreshold(d('2026-10-16'), now)).toMatchObject({ type: 'upcoming', threshold: 1 });
    expect(evaluateThreshold(d('2026-10-15'), now)).toMatchObject({ type: 'upcoming', threshold: 0 });
    expect(evaluateThreshold(d('2027-01-01'), now)).toBeNull();
  });
  it('overdue reminders are weekly and bounded', () => {
    expect(evaluateThreshold(d('2026-10-14'), now)).toMatchObject({ type: 'overdue', bucket: 0 });
    expect(evaluateThreshold(d('2026-10-07'), now)).toMatchObject({ type: 'overdue', bucket: 1 });
    expect(evaluateThreshold(d('2026-01-01'), now)).toBeNull();
  });
  it('produces a stable dedupe key, so re-evaluation cannot create a second alert', () => {
    const hit = evaluateThreshold(d('2026-10-20'), now)!;
    const a = dedupeKey({ kind: 'RENEWAL_DUE', subjectId: 'sub-1', targetDate: d('2026-10-20'), hit });
    const b = dedupeKey({ kind: 'RENEWAL_DUE', subjectId: 'sub-1', targetDate: d('2026-10-20'), hit: evaluateThreshold(d('2026-10-20'), new Date('2026-10-15T23:00:00Z'))! });
    expect(a).toBe(b);
    expect(a).toBe('RENEWAL_DUE:sub-1:2026-10-20:t7');
    expect(severityFor(hit)).toBe('warning');
  });
  it('rejects unsafe threshold lists', () => {
    expect(sanitizeThresholds([7, 30, 7, 0])).toEqual([30, 7, 0]);
    expect(sanitizeThresholds([-1])).toBeNull();
    expect(sanitizeThresholds([])).toBeNull();
    expect(sanitizeThresholds('x')).toBeNull();
  });
});

describe('domain validation and IDN normalisation', () => {
  it('accepts supported shapes', () => {
    for (const name of ['example.com', 'example.in', 'example.co.in', 'example.store', 'EXAMPLE.COM.']) expect(normalizeDomain(name).ok).toBe(true);
  });
  it('normalises IDNs to punycode', () => {
    const r = normalizeDomain('bücher.de');
    expect(r.ok && r.value.ascii).toBe('xn--bcher-kva.de');
    expect(r.ok && r.value.unicode).toBe('bücher.de');
  });
  it('strips a URL down to its host and rejects dangerous input', () => {
    const r = normalizeDomain('https://www.Example.com/path');
    expect(r.ok && r.value.ascii).toBe('www.example.com');
    for (const bad of ['', 'localhost', '127.0.0.1', '10.0.0.1', 'a b.com', 'x.internal', '-bad.com', 'foo', '*.example.com', 'user@example.com', 'example.com:8080', '1.2.3']) {
      expect(normalizeDomain(bad).ok, bad).toBe(false);
    }
  });
});

describe('RDAP parsing', () => {
  const bootstrap = { services: [[['com', 'net'], ['https://rdap.verisign.com/com/v1/']], [['in'], ['http://insecure.example/', 'https://rdap.registry.in/']], [['xx'], ['http://only-http.example/']]] as Array<[string[], string[]]> };
  it('discovers the authoritative server per TLD and refuses non-HTTPS', () => {
    expect(pickRdapServer(bootstrap, 'com')).toBe('https://rdap.verisign.com/com/v1/');
    expect(pickRdapServer(bootstrap, 'in')).toBe('https://rdap.registry.in/');
    expect(pickRdapServer(bootstrap, 'xx')).toBeNull();
    expect(pickRdapServer(bootstrap, 'zz')).toBeNull();
  });
  it('extracts dates, registrar, statuses, nameservers and DNSSEC', () => {
    const p = parseRdapDomain({
      events: [{ eventAction: 'registration', eventDate: '2015-03-01T00:00:00Z' }, { eventAction: 'expiration', eventDate: '2027-03-01T00:00:00Z' }, { eventAction: 'last changed', eventDate: '2026-02-01T10:00:00Z' }],
      status: ['client transfer prohibited'],
      nameservers: [{ ldhName: 'NS2.EXAMPLE.COM' }, { ldhName: 'ns1.example.com' }],
      secureDNS: { delegationSigned: true },
      entities: [{ roles: ['registrar'], vcardArray: ['vcard', [['version', {}, 'text', '4.0'], ['fn', {}, 'text', 'Example Registrar, Inc.']]] }],
    });
    expect(p.registrar).toBe('Example Registrar, Inc.');
    expect(iso(p.registryExpiresAt)).toBe('2027-03-01');
    expect(iso(p.registeredAt)).toBe('2015-03-01');
    expect(p.nameservers).toEqual(['ns1.example.com', 'ns2.example.com']);
    expect(p.dnssec).toBe(true);
    expect(p.registrarExpiresAt).toBeNull();
  });
  it('leaves missing values null instead of inventing them', () => {
    const p = parseRdapDomain({});
    expect(p).toMatchObject({ registrar: null, registeredAt: null, registryExpiresAt: null, dnssec: null, statuses: [], nameservers: [] });
  });
  it('classifies unsupported TLD and missing expiry without calling the network', async () => {
    expect((await lookupDomain('example.zz', 'zz', { bootstrap })).state).toBe('UNSUPPORTED');
  });
});

describe('DNS inspection and change detection', () => {
  const base: DnsRecords = { ...EMPTY_RECORDS, A: ['1.1.1.1'], NS: ['ns1.x.com'], MX: [{ priority: 10, exchange: 'mx.x.com' }], TXT: ['v=spf1 include:_spf.x.com ~all'] };
  it('reports additions and removals, ignoring SOA serial churn', () => {
    const next: DnsRecords = { ...base, A: ['2.2.2.2'], TXT: [...base.TXT, 'site-verification=abc'], SOA: { nsname: 'ns1', hostmaster: 'h', serial: 2, refresh: 1, retry: 1, expire: 1, minttl: 1 } };
    const prev: DnsRecords = { ...base, SOA: { nsname: 'ns1', hostmaster: 'h', serial: 1, refresh: 1, retry: 1, expire: 1, minttl: 1 } };
    const changes = diffRecords(prev, next);
    expect(changes.find((c) => c.type === 'A')).toEqual({ type: 'A', added: ['2.2.2.2'], removed: ['1.1.1.1'] });
    expect(changes.find((c) => c.type === 'SOA')).toBeUndefined();
    expect(hashRecords(prev)).toBe(hashRecords({ ...prev, SOA: { ...prev.SOA!, serial: 99 } }));
  });
  it('does not report a resolver failure as records removed', () => {
    expect(diffRecords(base, { ...EMPTY_RECORDS }, ['A', 'NS', 'MX', 'TXT'])).toEqual([]);
  });
  it('redacts TXT contents for viewers who may not see them', () => {
    expect(describeTxt('v=spf1 include:x ~all')).toBe('SPF policy (hidden)');
    const r = redactForViewer(base, false);
    expect(r.TXT).toEqual(['SPF policy (hidden)']);
    expect(redactForViewer(base, true).TXT).toEqual(base.TXT);
  });
  it('treats NODATA as empty but surfaces real lookup failures per type', async () => {
    const err = (code: string) => Object.assign(new Error(code), { code });
    const resolver = {
      resolve4: async () => ['9.9.9.9'], resolve6: async () => { throw err('ENODATA'); }, resolveMx: async () => { throw err('ETIMEOUT'); },
      resolveNs: async () => ['NS1.X.COM'], resolveCname: async () => { throw err('ENODATA'); }, resolveTxt: async () => [['v=spf1 ', '~all']],
      resolveCaa: async () => [{ critical: 0, issue: 'letsencrypt.org' }], resolveSoa: async () => { throw err('ENOTFOUND'); },
    } as unknown as DnsResolverLike;
    const out = await lookupDns('x.com', resolver);
    expect(out.records.A).toEqual(['9.9.9.9']);
    expect(out.records.NS).toEqual(['ns1.x.com']);
    expect(out.records.TXT).toEqual(['v=spf1 ~all']);
    expect(out.records.CAA).toEqual([{ critical: 0, tag: 'issue', value: 'letsencrypt.org' }]);
    expect(out.errors).toEqual({ MX: 'ETIMEOUT' });
  });
});

describe('SSL certificate inspection', () => {
  it('extracts names, issuer and validity from a peer certificate', () => {
    const info = parsePeerCertificate({
      subject: { CN: 'Example.com' }, subjectaltname: 'DNS:example.com, DNS:www.example.com, IP Address:1.2.3.4', issuer: { O: "Let's Encrypt", CN: 'R11' },
      valid_from: 'Jan  1 00:00:00 2026 GMT', valid_to: 'Apr  1 00:00:00 2026 GMT', fingerprint256: 'AA:BB',
    } as never);
    expect(info.commonName).toBe('example.com');
    expect(info.sans).toEqual(['example.com', 'www.example.com']);
    expect(info.issuer).toBe("Let's Encrypt / R11");
    expect(iso(info.validTo)).toBe('2026-04-01');
  });
  it('classifies valid, expiring, expired and unknown', () => {
    const now = new Date('2026-10-15T12:00:00Z');
    expect(certificateState(d('2027-03-01'), now)).toMatchObject({ state: 'VALID' });
    expect(certificateState(d('2026-11-01'), now)).toMatchObject({ state: 'EXPIRING', daysRemaining: 17 });
    expect(certificateState(d('2026-10-01'), now).state).toBe('EXPIRED');
    expect(certificateState(null, now).state).toBe('UNKNOWN');
  });
  it('refuses private targets, IP literals and non-allowlisted ports (SSRF)', async () => {
    expect(() => assertProbeTarget('example.com', 22)).toThrow();
    expect(() => assertProbeTarget('1.2.3.4', 443)).toThrow();
    const priv = await probeCertificate('internal.example.com', 443, { resolve: async () => ['169.254.169.254'] });
    expect(priv.ok).toBe(false);
    expect(priv.error).toMatch(/Private|local/i);
    const meta = await probeCertificate('rebind.example.com', 443, { resolve: async () => ['93.184.216.34', '127.0.0.1'] });
    expect(meta.ok).toBe(false);
  });
});

describe('Contabo adapter', () => {
  const creds = { clientId: 'INT-123456', clientSecret: 's3cret', apiUser: 'ops@example.com', apiPassword: 'p@ss' };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('maps only fields present and never treats cancelDate as a renewal date', () => {
    const s = mapContaboInstance({ instanceId: 201, name: 'vmi1', displayName: 'Prod API', status: 'running', productType: 'vps', productName: 'VPS S', regionName: 'EU', dataCenter: 'Nuremberg', cpuCores: 4, ramMb: 8192, diskMb: 204800, osType: 'Linux', cancelDate: '2027-01-01', createdDate: '2025-05-01T00:00:00Z', ipConfig: { v4: { ip: '203.0.113.9' } } })!;
    expect(s).toMatchObject({ remoteId: '201', name: 'Prod API', ipv4: '203.0.113.9', ipv6: null, vcpu: 4, ramMb: 8192, storageGb: 200, serverType: 'VPS', providerStatus: 'running' });
    expect(s.providerReported.cancelDate).toBe('2027-01-01');
    expect(Object.keys(s)).not.toContain('nextDueDate');
    expect(mapContaboInstance({ name: 'no id' })).toBeNull();
    expect(mapContaboInstance({ instanceId: 5 })).toMatchObject({ vcpu: null, ramMb: null, storageGb: null, ipv4: null });
  });
  it('reports authentication failures without leaking credentials', async () => {
    const fetchImpl = vi.fn(async () => json(401, { error: 'invalid_grant' }));
    const err = await new ContaboAdapter(fetchImpl).testConnection(creds).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.code).toBe('AUTH_FAILED');
    expect(JSON.stringify(err.message)).not.toContain('s3cret');
    expect(JSON.stringify(err.message)).not.toContain('p@ss');
  });
  it('lists across pages and reports a partial sync when a later page fails', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('openid-connect/token')) return json(200, { access_token: 'tok' });
      calls += 1;
      if (url.includes('page=1')) return json(200, { data: [{ instanceId: 1 }, { instanceId: 2 }], _pagination: { totalPages: 3 } });
      if (url.includes('page=2')) return json(503, {});
      return json(200, { data: [{ instanceId: 3 }], _pagination: { totalPages: 3 } });
    });
    const res = await new ContaboAdapter(fetchImpl as never).listServers(creds);
    expect(res.servers.map((s) => s.remoteId)).toEqual(['1', '2', '3']);
    expect(res.errors).toHaveLength(1);
    expect(calls).toBe(3);
  });
  it('sends the bearer token and request id to the documented endpoint, read-only', async () => {
    const seen: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return url.includes('openid-connect') ? json(200, { access_token: 'tok' }) : json(200, { data: [], _pagination: { totalPages: 1 } });
    });
    await new ContaboAdapter(fetchImpl as never).listServers(creds);
    const api = seen.find((s) => s.url.startsWith('https://api.contabo.com/v1/compute/instances'))!;
    expect(api.init.method).toBe('GET');
    expect((api.init.headers as Record<string, string>).authorization).toBe('Bearer tok');
    expect((api.init.headers as Record<string, string>)['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('validates credential input and produces masked hints', () => {
    const a = new ContaboAdapter();
    expect(a.parseCredentials({ clientId: 'x' }).ok).toBe(false);
    const ok = a.parseCredentials(creds);
    expect(ok.ok).toBe(true);
    expect(JSON.stringify(a.hint(creds))).not.toContain('s3cret');
    expect(a.hint(creds).clientId).toBe('…3456');
  });
  it('registry labels Contabo as live and everything else as manual', () => {
    const cat = new ProviderRegistry().catalogue();
    expect(cat.find((p) => p.key === 'contabo')).toMatchObject({ live: true, capabilities: { inventory: 'automatic_api', billing: 'unsupported' } });
    expect(cat.find((p) => p.key === 'hetzner')).toMatchObject({ live: false, capabilities: { inventory: 'manual' } });
  });
});
