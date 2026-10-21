import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_THRESHOLDS, applySample, bucketSeconds, collectorState, computeHealth, deriveRates, instantLevels, memUsedPct, parsePush, scrubImage,
  type Counters, type HealthInput, type RuleStates, type SampleView,
} from '../../src/modules/infrastructure/core/server-metrics';
import { ContaboAdapter, mapContaboInstance } from '../../src/modules/infrastructure/core/providers/contabo.adapter';

const NOW = new Date('2026-10-15T12:00:00.000Z');
const base = (over: Record<string, unknown> = {}) => ({
  v: 1,
  ts: NOW.toISOString(),
  cpu: { user: 100, nice: 0, system: 50, idle: 800, iowait: 10, irq: 0, softirq: 0, steal: 0 },
  memory: { totalBytes: 8_000_000_000, availableBytes: 2_000_000_000, swapTotalBytes: 1_000_000_000, swapFreeBytes: 900_000_000 },
  ...over,
});

describe('collector payload validation', () => {
  it('accepts a well-formed push and derives swap used', () => {
    const r = parsePush(base({ load: [0.5, 0.4, 0.3], uptimeSec: 3600, filesystems: [{ mount: '/', totalBytes: 100, usedBytes: 40 }] }), NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.memory?.swapUsedBytes).toBe(100_000_000);
      expect(r.value.filesystems[0]?.usedPct).toBe(40);
      expect(memUsedPct(r.value.memory)).toBe(75);
    }
  });
  it('rejects tampered or impossible telemetry', () => {
    const bad = (payload: unknown) => { const r = parsePush(payload, NOW); return r.ok ? 'ok' : r.reason; };
    expect(bad(null)).toMatch(/object/);
    expect(bad({ v: 2 })).toMatch(/version/);
    expect(bad(base({ ts: 'not a date' }))).toMatch(/timestamp/);
    expect(bad(base({ ts: new Date(NOW.getTime() + 3_600_000).toISOString() }))).toMatch(/future/);
    expect(bad(base({ ts: new Date(NOW.getTime() - 3 * 3_600_000).toISOString() }))).toMatch(/old/);
    expect(bad(base({ memory: { totalBytes: 100, availableBytes: 500 } }))).toMatch(/exceeds/);
    expect(bad(base({ cpu: { user: 'x' } }))).toMatch(/cpu/);
  });
  it('drops malformed filesystems and strips control characters, credentials and unknown fields', () => {
    const r = parsePush(base({
      filesystems: [{ mount: '/data<script>', totalBytes: 10, usedBytes: 50 }, { mount: '/ok', totalBytes: 10, usedBytes: 5 }, 'junk', { mount: '/neg', totalBytes: -1, usedBytes: 0 }],
      containers: [{ id: 'abcdef1234567890', name: '/web', image: 'user:pw@registry.example/app:1', state: 'RUNNING', command: 'secret --password=hunter2', env: ['TOKEN=1'] }],
    }), NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.filesystems.map((f) => f.mount)).toEqual(['/ok']);
    const c = r.value.report.containers[0]!;
    expect(c).toMatchObject({ id: 'abcdef123456', name: 'web', state: 'running' });
    expect(c.image).toBe('registry.example/app:1');
    expect(JSON.stringify(r.value)).not.toMatch(/hunter2|TOKEN/);
    expect(scrubImage('https://u:p@r.io/x')).toBe('r.io/x');
  });
  it('bounds list sizes', () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ id: `c${i}`, name: `n${i}`, image: 'i', state: 'running' }));
    const r = parsePush(base({ containers: many }), NOW);
    expect(r.ok && r.value.report.containers.length).toBe(200);
  });
});

describe('counter -> rate conversion', () => {
  const at = (s: number): number => NOW.getTime() + s * 1000;
  const c = (s: number, o: Partial<Counters> = {}): Counters => ({
    at: at(s), cpu: { user: 0, system: 0, idle: 0, iowait: 0, nice: 0, irq: 0, softirq: 0, steal: 0 }, diskRead: 0, diskWrite: 0, netRx: 0, netTx: 0, netErr: 0, netDrop: 0, ...o,
  });
  it('computes CPU percentages and per-second rates', () => {
    const prev = c(0);
    const cur = c(60, { cpu: { user: 300, nice: 0, system: 100, idle: 500, iowait: 100, irq: 0, softirq: 0, steal: 0 }, netRx: 6_000_000, netTx: 600_000, diskRead: 1_200_000, diskWrite: 0, netErr: 120 });
    const r = deriveRates(prev, cur);
    expect(r.cpuPct).toBeCloseTo(40, 5); // (1000 - 500 idle - 100 iowait) / 1000
    expect(r.cpuUserPct).toBeCloseTo(30, 5);
    expect(r.cpuIowaitPct).toBeCloseTo(10, 5);
    expect(r.netRxBps).toBe(100_000);
    expect(r.diskReadBps).toBe(20_000);
    expect(r.netErrPerSec).toBe(2);
    expect(r.counterReset).toBe(false);
  });
  it('withholds rates on a counter reset instead of reporting a negative or huge value', () => {
    const prev = c(0, { netRx: 5_000_000, cpu: { user: 900, system: 90, idle: 9000, iowait: 0, nice: 0, irq: 0, softirq: 0, steal: 0 } });
    const cur = c(60, { netRx: 1000, cpu: { user: 10, system: 1, idle: 100, iowait: 0, nice: 0, irq: 0, softirq: 0, steal: 0 } });
    const r = deriveRates(prev, cur);
    expect(r.counterReset).toBe(true);
    expect(r.netRxBps).toBeNull();
    expect(r.cpuPct).toBeNull();
  });
  it('has no rates without a baseline, for out-of-order samples, or across a long gap', () => {
    expect(deriveRates(null, c(60)).cpuPct).toBeNull();
    expect(deriveRates(c(60), c(0)).netRxBps).toBeNull();
    expect(deriveRates(c(0), c(3600)).netRxBps).toBeNull();
  });
});

describe('threshold rules with hysteresis', () => {
  const view = (o: Partial<SampleView> = {}): SampleView => ({ cpuPct: 10, memUsedPct: 40, swapUsedPct: 0, diskMaxUsedPct: 50, netErrPerSec: 0, maxContainerRestartDelta: null, ...o });
  const run = (samples: SampleView[], start: RuleStates = {}) => {
    let state = start;
    const all: Array<{ rule: string; type: string; i: number }> = [];
    samples.forEach((s, i) => {
      const out = applySample(state, instantLevels(s, DEFAULT_THRESHOLDS), DEFAULT_THRESHOLDS, new Date(NOW.getTime() + i * 60_000));
      state = out.state;
      for (const t of out.transitions) all.push({ rule: t.rule, type: t.type, i });
    });
    return { state, all };
  };
  it('does not alert on a single spike', () => {
    const { all } = run([view(), view({ cpuPct: 99 }), view(), view({ cpuPct: 99 }), view()]);
    expect(all).toEqual([]);
  });
  it('opens once after sustained breach, never repeats, then recovers after clean samples', () => {
    const hot = Array.from({ length: 12 }, () => view({ cpuPct: 92 }));
    const cool = Array.from({ length: 4 }, () => view({ cpuPct: 20 }));
    const { all } = run([...hot, ...cool]);
    expect(all.filter((t) => t.type === 'open')).toEqual([{ rule: 'cpu', type: 'open', i: 4 }]);
    expect(all.filter((t) => t.type === 'recover')).toEqual([{ rule: 'cpu', type: 'recover', i: 14 }]);
  });
  it('escalates disk from warning to critical without opening a second alert', () => {
    const { all } = run([...Array.from({ length: 5 }, () => view({ diskMaxUsedPct: 88 })), view({ diskMaxUsedPct: 96 })]);
    expect(all).toEqual([{ rule: 'disk', type: 'open', i: 4 }, { rule: 'disk', type: 'escalate', i: 5 }]);
  });
  it('a sample with no data for a rule neither opens nor clears it', () => {
    const { state } = run([...Array.from({ length: 4 }, () => view({ cpuPct: 95 })), view({ cpuPct: null }), view({ cpuPct: 95 })]);
    expect(state.cpu?.openedAt).not.toBeNull();
  });
  it('flags container restart bursts', () => {
    const { all } = run(Array.from({ length: 5 }, () => view({ maxContainerRestartDelta: 4 })));
    expect(all.map((t) => t.rule)).toEqual(['container_restarts']);
  });
});

describe('explainable health', () => {
  const input = (o: Partial<HealthInput> = {}): HealthInput => ({
    now: NOW, providerStatus: 'running', providerSuspended: false, hasCollector: false, collectorRevoked: false, lastSampleAt: null, latest: null, rules: {},
    thresholds: DEFAULT_THRESHOLDS, unhealthyServices: null, restartingContainers: null, billingDaysRemaining: 90, billingOverdue: false, ...o,
  });
  it('a missing collector is "unknown", never unhealthy, and lowers confidence only', () => {
    const h = computeHealth(input());
    expect(h.collectorState).toBe('not_configured');
    expect(h.overall).toBe('ok');
    expect(h.confidence).not.toBe('high');
    expect(h.dimensions.find((d) => d.key === 'performance')?.status).toBe('unknown');
    expect(h.dimensions.find((d) => d.key === 'collector')?.reason).toMatch(/not configured/i);
  });
  it('an offline collector warns but does not claim the server is down', () => {
    const h = computeHealth(input({ hasCollector: true, lastSampleAt: new Date(NOW.getTime() - 20 * 60_000) }));
    expect(h.collectorState).toBe('offline');
    const d = h.dimensions.find((x) => x.key === 'collector')!;
    expect(d.status).toBe('warning');
    expect(h.dimensions.find((x) => x.key === 'provider')?.status).toBe('ok');
  });
  it('provider suspension and sustained pressure are reported separately', () => {
    const h = computeHealth(input({
      providerSuspended: true, hasCollector: true, lastSampleAt: NOW, latest: { cpuPct: 95, memUsedPct: 40, swapUsedPct: 0, diskMaxUsedPct: 97, netErrPerSec: 0, maxContainerRestartDelta: null },
      rules: { cpu: { breaches: 9, clears: 0, openedAt: NOW.toISOString(), severity: 'warning' }, disk: { breaches: 9, clears: 0, openedAt: NOW.toISOString(), severity: 'critical' } },
    }));
    expect(h.overall).toBe('critical');
    expect(h.dimensions.find((d) => d.key === 'provider')?.status).toBe('critical');
    expect(h.dimensions.find((d) => d.key === 'performance')?.status).toBe('warning');
    expect(h.dimensions.find((d) => d.key === 'storage')?.status).toBe('critical');
    expect(h.confidence).toBe('high');
  });
  it('classifies collector freshness', () => {
    const s = (ageMs: number) => collectorState({ now: NOW, hasCollector: true, collectorRevoked: false, lastSampleAt: new Date(NOW.getTime() - ageMs) });
    expect([s(30_000), s(4 * 60_000), s(6 * 60_000)]).toEqual(['online', 'stale', 'offline']);
    expect(collectorState({ now: NOW, hasCollector: true, collectorRevoked: true, lastSampleAt: NOW })).toBe('revoked');
    // Registered but never heard from: setup is unfinished, which is not an outage.
    expect(collectorState({ now: NOW, hasCollector: true, collectorRevoked: false, lastSampleAt: null })).toBe('pending');
    expect(computeHealth({ now: NOW, providerStatus: 'running', providerSuspended: false, hasCollector: true, collectorRevoked: false, lastSampleAt: null, latest: null, rules: {}, thresholds: DEFAULT_THRESHOLDS, unhealthyServices: null, restartingContainers: null, billingDaysRemaining: null, billingOverdue: false })
      .dimensions.find((d) => d.key === 'collector')?.status).toBe('unknown');
  });
  it('keeps charts bounded for every range', () => {
    for (const [r, secs] of [['1h', 3600], ['6h', 21600], ['24h', 86400], ['7d', 604800], ['30d', 2592000]] as const) {
      expect(secs / bucketSeconds(r)).toBeLessThanOrEqual(260);
    }
  });
});

describe('Contabo detail mapping (schema verified against the live API)', () => {
  it('maps "ssd" Cloud VPS products as VPS and keeps provider extras separate from billing', () => {
    const s = mapContaboInstance({
      instanceId: 1, name: 'vmi1', displayName: 'Prod', productType: 'ssd', productName: 'Cloud VPS 4 (2026) (no setup)', status: 'running', cpuCores: 6, ramMb: 12288, diskMb: 307200,
      vHostName: 'host-2', vHostNumber: 2, defaultUser: 'root', addOns: [{ id: 7, quantity: 1 }], imageId: 'img', gpuVendor: null, cancelDate: null, ipConfig: { v4: { ip: '203.0.113.1' }, v6: { ip: '2001:db8::1' } },
    })!;
    expect(s.serverType).toBe('VPS');
    expect(s.providerReported).toMatchObject({ vHostName: 'host-2', addOns: '#7×1', cancelDate: null });
    expect(s.storageGb).toBe(300);
    expect(JSON.stringify(s)).not.toMatch(/password|secret/i);
  });
  it('reads snapshots and audit trail read-only and reports a failing source', async () => {
    const calls: string[] = [];
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      calls.push(`${init.method} ${url.replace('https://api.contabo.com/v1', '')}`);
      if (url.includes('openid-connect')) return json(200, { access_token: 't' });
      if (url.includes('/snapshots')) return json(200, { data: [{ snapshotId: 's1', name: 'pre-upgrade', createdDate: '2026-10-01T00:00:00Z', autoDeleteDate: '2026-11-01T00:00:00Z', imageName: 'ubuntu' }] });
      return json(503, {});
    });
    const out = await new ContaboAdapter(fetchImpl as never).getServerExtras({ clientId: 'a', clientSecret: 'b', apiUser: 'c', apiPassword: 'd' }, '12345');
    expect(out.snapshots[0]).toMatchObject({ id: 's1', name: 'pre-upgrade', autoDeleteAt: '2026-11-01T00:00:00Z' });
    expect(out.audits).toEqual([]);
    expect(out.errors).toHaveLength(1);
    expect(calls.filter((c) => !c.includes('openid')).every((c) => c.startsWith('GET '))).toBe(true);
    await expect(new ContaboAdapter(fetchImpl as never).getServerExtras({ clientId: 'a', clientSecret: 'b', apiUser: 'c', apiPassword: 'd' }, '../etc')).rejects.toThrow();
  });
});

describe('cpu rate with a non-monotonic iowait counter', () => {
  it('still reports CPU when only iowait stepped backwards', () => {
    const prev = { at: 0, cpu: { user: 1000, nice: 0, system: 500, idle: 8000, iowait: 300, irq: 0, softirq: 10, steal: 0 } };
    const cur = { at: 60_000, cpu: { user: 1100, nice: 0, system: 550, idle: 8800, iowait: 299, irq: 0, softirq: 12, steal: 0 } };
    const r = deriveRates(prev as never, cur as never);
    expect(r.counterReset).toBe(false);
    expect(r.cpuPct).not.toBeNull();
  });
  it('still treats user/idle going backwards as a reset', () => {
    const prev = { at: 0, cpu: { user: 1000, system: 500, idle: 8000, iowait: 300 } };
    const cur = { at: 60_000, cpu: { user: 10, system: 5, idle: 80, iowait: 3 } };
    const r = deriveRates(prev as never, cur as never);
    expect(r.counterReset).toBe(true);
    expect(r.cpuPct).toBeNull();
  });
});
