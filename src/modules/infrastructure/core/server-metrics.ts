export const MIN_SAMPLE_INTERVAL_MS = 15_000;
export const COLLECTOR_OFFLINE_MS = 5 * 60_000;
export const STALE_MS = 3 * 60_000;
export const MAX_SKEW_PAST_MS = 10 * 60_000;
export const MAX_SKEW_FUTURE_MS = 2 * 60_000;

export interface Counters {
  at: number; // epoch ms
  cpu?: Record<string, number>;
  diskRead?: number;
  diskWrite?: number;
  netRx?: number;
  netTx?: number;
  netErr?: number;
  netDrop?: number;
}

export interface Filesystem {
  mount: string;
  fstype: string | null;
  totalBytes: number;
  usedBytes: number;
  usedPct: number;
  inodesUsedPct: number | null;
  readOnly: boolean | null;
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string | null;
  health: string | null;
  restartCount: number | null;
  cpuPct: number | null;
  memBytes: number | null;
  memLimitBytes: number | null;
  netRxBytes: number | null;
  netTxBytes: number | null;
  startedAt: string | null;
}

export interface CollectorReport {
  containers: ContainerInfo[];
  services: Array<{ name: string; state: string }>;
  security: { rebootRequired: boolean | null; pendingUpdates: number | null; securityUpdates: number | null; firewall: 'active' | 'inactive' | 'unknown' | null; listeningPorts: Array<{ port: number; proto: string }> } | null;
}

export interface HostFacts {
  hostname: string | null;
  os: string | null;
  kernel: string | null;
  arch: string | null;
  bootTime: string | null;
  cpuCores: number | null;
}

export interface ParsedPush {
  ts: Date;
  agentVersion: string | null;
  host: HostFacts | null;
  cumulative: Counters;
  load: [number, number, number] | null;
  memory: { totalBytes: number; availableBytes: number; cachedBytes: number | null; swapTotalBytes: number | null; swapUsedBytes: number | null } | null;
  filesystems: Filesystem[];
  uptimeSec: number | null;
  report: CollectorReport;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
/** Prints only safe characters: names/mounts come from the guest and are shown in the UI. */
const label = (v: unknown, max: number): string | null => {
  const s = str(v, max);
  return s ? s.replace(/[\u0000-\u001f\u007f<>]/g, '') : null;
};
/** Removes embedded registry credentials from an image reference (user:pass@host/img). */
export function scrubImage(image: string): string {
  return image.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^[^/@\s]+@/, '').slice(0, 200);
}

export type ParseResult = { ok: true; value: ParsedPush } | { ok: false; reason: string };

export function parsePush(raw: unknown, now = new Date()): ParseResult {
  if (!isObj(raw)) return { ok: false, reason: 'Payload must be a JSON object.' };
  if (raw.v !== 1) return { ok: false, reason: 'Unsupported payload version (expected v: 1).' };
  let ts = now;
  if (raw.ts !== undefined) {
    const parsed = typeof raw.ts === 'string' || typeof raw.ts === 'number' ? new Date(raw.ts) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return { ok: false, reason: 'ts is not a valid timestamp.' };
    ts = parsed;
  }
  const skew = ts.getTime() - now.getTime();
  if (skew > MAX_SKEW_FUTURE_MS) return { ok: false, reason: 'Sample timestamp is in the future (check the server clock).' };
  if (-skew > MAX_SKEW_PAST_MS) return { ok: false, reason: 'Sample is too old to accept.' };

  const cumulative: Counters = { at: ts.getTime() };
  if (isObj(raw.cpu)) {
    const cpu: Record<string, number> = {};
    for (const k of ['user', 'nice', 'system', 'idle', 'iowait', 'irq', 'softirq', 'steal']) {
      const v = num(raw.cpu[k]);
      if (v !== null) cpu[k] = v;
    }
    if (cpu.idle === undefined || cpu.user === undefined || cpu.system === undefined) return { ok: false, reason: 'cpu needs at least user, system and idle jiffies.' };
    cumulative.cpu = cpu;
  }
  if (isObj(raw.disk)) {
    cumulative.diskRead = num(raw.disk.readBytes) ?? undefined;
    cumulative.diskWrite = num(raw.disk.writeBytes) ?? undefined;
  }
  if (isObj(raw.network)) {
    cumulative.netRx = num(raw.network.rxBytes) ?? undefined;
    cumulative.netTx = num(raw.network.txBytes) ?? undefined;
    const errs = (num(raw.network.rxErrors) ?? 0) + (num(raw.network.txErrors) ?? 0);
    const drops = (num(raw.network.rxDrops) ?? 0) + (num(raw.network.txDrops) ?? 0);
    cumulative.netErr = errs;
    cumulative.netDrop = drops;
  }

  let load: ParsedPush['load'] = null;
  if (Array.isArray(raw.load) && raw.load.length === 3) {
    const l = raw.load.map((x) => num(x, 0, 100_000));
    if (l.every((x): x is number => x !== null)) load = [l[0]!, l[1]!, l[2]!];
  }

  let memory: ParsedPush['memory'] = null;
  if (isObj(raw.memory)) {
    const total = num(raw.memory.totalBytes, 1);
    const avail = num(raw.memory.availableBytes);
    if (total === null || avail === null) return { ok: false, reason: 'memory needs totalBytes and availableBytes.' };
    if (avail > total) return { ok: false, reason: 'memory.availableBytes exceeds totalBytes.' };
    const swapTotal = num(raw.memory.swapTotalBytes);
    const swapFree = num(raw.memory.swapFreeBytes);
    memory = {
      totalBytes: total,
      availableBytes: avail,
      cachedBytes: num(raw.memory.cachedBytes),
      swapTotalBytes: swapTotal,
      swapUsedBytes: swapTotal !== null && swapFree !== null && swapFree <= swapTotal ? swapTotal - swapFree : null,
    };
  }

  const filesystems: Filesystem[] = [];
  if (Array.isArray(raw.filesystems)) {
    for (const fs of raw.filesystems.slice(0, 32)) {
      if (!isObj(fs)) continue;
      const mount = label(fs.mount, 200);
      const total = num(fs.totalBytes, 1);
      const used = num(fs.usedBytes);
      if (!mount || total === null || used === null || used > total * 1.001) continue;
      const inodesTotal = num(fs.inodesTotal, 1);
      const inodesUsed = num(fs.inodesUsed);
      filesystems.push({
        mount,
        fstype: label(fs.fstype, 30),
        totalBytes: total,
        usedBytes: Math.min(used, total),
        usedPct: Math.min(100, (used / total) * 100),
        inodesUsedPct: inodesTotal !== null && inodesUsed !== null ? Math.min(100, (inodesUsed / inodesTotal) * 100) : null,
        readOnly: typeof fs.readOnly === 'boolean' ? fs.readOnly : null,
      });
    }
  }

  let host: HostFacts | null = null;
  if (isObj(raw.host)) {
    const boot = raw.host.bootTime;
    const bootDate = typeof boot === 'string' || typeof boot === 'number' ? new Date(boot) : null;
    host = {
      hostname: label(raw.host.hostname, 255),
      os: label(raw.host.os, 120),
      kernel: label(raw.host.kernel, 120),
      arch: label(raw.host.arch, 30),
      bootTime: bootDate && !Number.isNaN(bootDate.getTime()) ? bootDate.toISOString() : null,
      cpuCores: num(raw.host.cpuCores, 1, 4096),
    };
  }

  const containers: ContainerInfo[] = [];
  if (Array.isArray(raw.containers)) {
    for (const c of raw.containers.slice(0, 200)) {
      if (!isObj(c)) continue;
      const id = label(c.id, 64);
      const name = label(c.name, 120);
      if (!id || !name) continue;
      containers.push({
        id: id.slice(0, 12),
        name: name.replace(/^\//, ''),
        image: scrubImage(label(c.image, 300) ?? ''),
        state: (label(c.state, 20) ?? 'unknown').toLowerCase(),
        status: label(c.status, 120),
        health: label(c.health, 20),
        restartCount: num(c.restartCount, 0, 1_000_000),
        cpuPct: num(c.cpuPct, 0, 100_000),
        memBytes: num(c.memBytes),
        memLimitBytes: num(c.memLimitBytes),
        netRxBytes: num(c.netRxBytes),
        netTxBytes: num(c.netTxBytes),
        startedAt: label(c.startedAt, 40),
      });
    }
  }

  const services: CollectorReport['services'] = [];
  if (Array.isArray(raw.services)) {
    for (const s of raw.services.slice(0, 100)) {
      if (!isObj(s)) continue;
      const name = label(s.name, 120);
      if (name) services.push({ name, state: (label(s.state, 20) ?? 'unknown').toLowerCase() });
    }
  }

  let security: CollectorReport['security'] = null;
  if (isObj(raw.security)) {
    const fw = label(raw.security.firewall, 12);
    security = {
      rebootRequired: typeof raw.security.rebootRequired === 'boolean' ? raw.security.rebootRequired : null,
      pendingUpdates: num(raw.security.pendingUpdates, 0, 100_000),
      securityUpdates: num(raw.security.securityUpdates, 0, 100_000),
      firewall: fw === 'active' || fw === 'inactive' || fw === 'unknown' ? fw : null,
      listeningPorts: Array.isArray(raw.security.listeningPorts)
        ? raw.security.listeningPorts
          .slice(0, 100)
          .map((p) => (isObj(p) ? { port: num(p.port, 1, 65535), proto: label(p.proto, 6) ?? 'tcp' } : null))
          .filter((p): p is { port: number; proto: string } => Boolean(p && p.port !== null))
        : [],
    };
  }

  return {
    ok: true,
    value: {
      ts,
      agentVersion: label(raw.agentVersion, 40),
      host,
      cumulative,
      load,
      memory,
      filesystems,
      uptimeSec: num(raw.uptimeSec, 0, 10 * 365 * 86_400),
      report: { containers, services, security },
    },
  };
}

export interface DerivedRates {
  cpuPct: number | null;
  cpuUserPct: number | null;
  cpuSystemPct: number | null;
  cpuIowaitPct: number | null;
  cpuStealPct: number | null;
  diskReadBps: number | null;
  diskWriteBps: number | null;
  netRxBps: number | null;
  netTxBps: number | null;
  netErrPerSec: number | null;
  netDropPerSec: number | null;
  /** True when a counter went backwards (reboot / agent restart): that interval's rates are withheld, not guessed. */
  counterReset: boolean;
}

const EMPTY_RATES: DerivedRates = { cpuPct: null, cpuUserPct: null, cpuSystemPct: null, cpuIowaitPct: null, cpuStealPct: null, diskReadBps: null, diskWriteBps: null, netRxBps: null, netTxBps: null, netErrPerSec: null, netDropPerSec: null, counterReset: false };

/** Per-second rate between two cumulative readings; null when there is no baseline or the counter reset. */
function rate(prev: number | undefined, cur: number | undefined, seconds: number): { value: number | null; reset: boolean } {
  if (prev === undefined || cur === undefined || seconds <= 0) return { value: null, reset: false };
  if (cur < prev) return { value: null, reset: true };
  return { value: (cur - prev) / seconds, reset: false };
}

export function deriveRates(prev: Counters | null, cur: Counters): DerivedRates {
  if (!prev) return { ...EMPTY_RATES };
  const seconds = (cur.at - prev.at) / 1000;
  // Out-of-order or too-wide gaps give meaningless averages: withhold rates, keep gauges.
  if (seconds <= 0 || seconds > 15 * 60) return { ...EMPTY_RATES };
  let reset = false;
  const out: DerivedRates = { ...EMPTY_RATES };

  if (prev.cpu && cur.cpu) {
    const keys = Object.keys(cur.cpu);
    const delta: Record<string, number> = {};
    let total = 0;
    let cpuReset = false;
    for (const k of keys) {
      const d = (cur.cpu[k] ?? 0) - (prev.cpu[k] ?? 0);
      // iowait is documented as non-monotonic in /proc/stat (it can step back on VMs): that alone is not a reboot.
      // A real reset (reboot / agent restart) moves user, system or idle backwards too.
      if (d < 0 && k !== 'iowait') cpuReset = true;
      delta[k] = Math.max(0, d);
      total += delta[k]!;
    }
    if (cpuReset) reset = true;
    else if (total > 0) {
      const pct = (v: number) => Math.min(100, Math.max(0, (v / total) * 100));
      out.cpuPct = pct(total - (delta.idle ?? 0) - (delta.iowait ?? 0));
      out.cpuUserPct = pct((delta.user ?? 0) + (delta.nice ?? 0));
      out.cpuSystemPct = pct((delta.system ?? 0) + (delta.irq ?? 0) + (delta.softirq ?? 0));
      out.cpuIowaitPct = pct(delta.iowait ?? 0);
      out.cpuStealPct = pct(delta.steal ?? 0);
    }
  }
  const pairs: Array<[keyof DerivedRates, number | undefined, number | undefined]> = [
    ['diskReadBps', prev.diskRead, cur.diskRead],
    ['diskWriteBps', prev.diskWrite, cur.diskWrite],
    ['netRxBps', prev.netRx, cur.netRx],
    ['netTxBps', prev.netTx, cur.netTx],
    ['netErrPerSec', prev.netErr, cur.netErr],
    ['netDropPerSec', prev.netDrop, cur.netDrop],
  ];
  for (const [key, p, c] of pairs) {
    const r = rate(p, c, seconds);
    if (r.reset) reset = true;
    (out as unknown as Record<string, number | null>)[key] = r.value;
  }
  out.counterReset = reset;
  return out;
}

/* ------------------------------------------------------------------ rules */

export interface Thresholds {
  cpuPct: number;
  memPct: number;
  diskWarnPct: number;
  diskCritPct: number;
  swapPct: number;
  netErrPerSec: number;
  /** Consecutive samples that must breach before an alert opens (hysteresis), and clear before it recovers. */
  sustainSamples: number;
  recoverSamples: number;
  containerRestarts: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = { cpuPct: 85, memPct: 90, diskWarnPct: 85, diskCritPct: 95, swapPct: 50, netErrPerSec: 10, sustainSamples: 5, recoverSamples: 3, containerRestarts: 3 };

export type RuleKey = 'cpu' | 'memory' | 'disk' | 'swap' | 'network_errors' | 'container_restarts';
export type RuleSeverity = 'warning' | 'critical';

export interface RuleState {
  breaches: number;
  clears: number;
  openedAt: string | null;
  severity: RuleSeverity | null;
}
export type RuleStates = Partial<Record<RuleKey, RuleState>>;

export interface SampleView {
  cpuPct: number | null;
  memUsedPct: number | null;
  swapUsedPct: number | null;
  diskMaxUsedPct: number | null;
  netErrPerSec: number | null;
  maxContainerRestartDelta: number | null;
}

export function memUsedPct(m: { totalBytes: number; availableBytes: number } | null): number | null {
  return m && m.totalBytes > 0 ? Math.min(100, Math.max(0, ((m.totalBytes - m.availableBytes) / m.totalBytes) * 100)) : null;
}

/** Instant breach level per rule for one sample; null = no data for that rule (does not count as healthy or unhealthy). */
export function instantLevels(s: SampleView, t: Thresholds): Record<RuleKey, RuleSeverity | 'ok' | null> {
  const lvl = (v: number | null, warn: number, crit?: number): RuleSeverity | 'ok' | null => (v === null ? null : crit !== undefined && v >= crit ? 'critical' : v >= warn ? 'warning' : 'ok');
  return {
    cpu: lvl(s.cpuPct, t.cpuPct),
    memory: lvl(s.memUsedPct, t.memPct),
    disk: lvl(s.diskMaxUsedPct, t.diskWarnPct, t.diskCritPct),
    swap: lvl(s.swapUsedPct, t.swapPct),
    network_errors: lvl(s.netErrPerSec, t.netErrPerSec),
    container_restarts: s.maxContainerRestartDelta === null ? null : s.maxContainerRestartDelta >= t.containerRestarts ? 'warning' : 'ok',
  };
}

export interface RuleTransition {
  rule: RuleKey;
  type: 'open' | 'recover' | 'escalate';
  severity: RuleSeverity;
  openedAt: string;
}

/**
 * Applies one sample to the persisted state. A rule opens only after `sustainSamples` consecutive breaches and recovers
 * only after `recoverSamples` consecutive clean samples, so a single spike never alerts and a flapping value does not
 * open/close repeatedly. A sample with no data for a rule leaves its counters untouched.
 */
export function applySample(state: RuleStates, levels: Record<RuleKey, RuleSeverity | 'ok' | null>, t: Thresholds, at: Date): { state: RuleStates; transitions: RuleTransition[] } {
  const next: RuleStates = {};
  const transitions: RuleTransition[] = [];
  for (const rule of Object.keys(levels) as RuleKey[]) {
    const cur: RuleState = { breaches: 0, clears: 0, openedAt: null, severity: null, ...(state[rule] ?? {}) };
    const level = levels[rule];
    if (level === null) {
      next[rule] = cur;
      continue;
    }
    if (level === 'ok') {
      cur.breaches = 0;
      cur.clears += 1;
      if (cur.openedAt && cur.clears >= t.recoverSamples) {
        transitions.push({ rule, type: 'recover', severity: cur.severity ?? 'warning', openedAt: cur.openedAt });
        cur.openedAt = null;
        cur.severity = null;
        cur.clears = 0;
      }
    } else {
      cur.clears = 0;
      cur.breaches += 1;
      if (!cur.openedAt && cur.breaches >= t.sustainSamples) {
        cur.openedAt = at.toISOString();
        cur.severity = level;
        transitions.push({ rule, type: 'open', severity: level, openedAt: cur.openedAt });
      } else if (cur.openedAt && level === 'critical' && cur.severity !== 'critical') {
        cur.severity = 'critical';
        transitions.push({ rule, type: 'escalate', severity: 'critical', openedAt: cur.openedAt });
      }
    }
    next[rule] = cur;
  }
  return { state: next, transitions };
}

/* ----------------------------------------------------------------- health */

export type HealthStatus = 'ok' | 'warning' | 'critical' | 'unknown';

export interface HealthDimension {
  key: 'provider' | 'collector' | 'performance' | 'storage' | 'services' | 'billing';
  label: string;
  status: HealthStatus;
  reason: string;
}

export interface HealthInput {
  now: Date;
  providerStatus: string | null;
  providerSuspended: boolean | null;
  hasCollector: boolean;
  collectorRevoked: boolean;
  lastSampleAt: Date | null;
  latest: SampleView | null;
  rules: RuleStates;
  thresholds: Thresholds;
  unhealthyServices: number | null;
  restartingContainers: number | null;
  billingDaysRemaining: number | null;
  billingOverdue: boolean;
}

export interface Health {
  overall: HealthStatus;
  /** How much of this verdict is backed by real measurements. A missing collector lowers confidence, never health. */
  confidence: 'high' | 'medium' | 'low';
  dimensions: HealthDimension[];
  collectorState: 'not_configured' | 'pending' | 'online' | 'stale' | 'offline' | 'revoked';
}

const rank: Record<HealthStatus, number> = { unknown: 0, ok: 1, warning: 2, critical: 3 };

export function collectorState(input: Pick<HealthInput, 'now' | 'hasCollector' | 'collectorRevoked' | 'lastSampleAt'>): Health['collectorState'] {
  if (!input.hasCollector) return 'not_configured';
  if (input.collectorRevoked) return 'revoked';
  // A token exists but nothing has ever arrived: setup is unfinished, which is not the same as a collector that went silent.
  if (!input.lastSampleAt) return 'pending';
  const age = input.now.getTime() - input.lastSampleAt.getTime();
  return age > COLLECTOR_OFFLINE_MS ? 'offline' : age > STALE_MS ? 'stale' : 'online';
}

export function computeHealth(i: HealthInput): Health {
  const cs = collectorState(i);
  const measured = cs === 'online' || cs === 'stale';
  const dims: HealthDimension[] = [];

  const ps = (i.providerStatus ?? '').toLowerCase();
  dims.push(
    i.providerSuspended
      ? { key: 'provider', label: 'Provider status', status: 'critical', reason: 'The provider reports this instance as suspended.' }
      : !i.providerStatus
        ? { key: 'provider', label: 'Provider status', status: 'unknown', reason: 'No provider status is available (manual server).' }
        : ps === 'running'
          ? { key: 'provider', label: 'Provider status', status: 'ok', reason: 'The provider reports the instance as running.' }
          : ['error', 'unknown', 'verification_required', 'product_not_available'].includes(ps)
            ? { key: 'provider', label: 'Provider status', status: 'critical', reason: `The provider reports "${i.providerStatus}".` }
            : { key: 'provider', label: 'Provider status', status: 'warning', reason: `The provider reports "${i.providerStatus}".` },
  );

  dims.push(
    cs === 'not_configured'
      ? { key: 'collector', label: 'Monitoring', status: 'unknown', reason: 'Advanced monitoring is not configured. This is not a fault.' }
      : cs === 'revoked'
        ? { key: 'collector', label: 'Monitoring', status: 'unknown', reason: 'The collector was removed.' }
        : cs === 'pending'
          ? { key: 'collector', label: 'Monitoring', status: 'unknown', reason: 'The collector is registered but has not sent its first sample yet. Run it on the server to finish setup.' }
          : cs === 'online'
            ? { key: 'collector', label: 'Monitoring', status: 'ok', reason: 'The collector is reporting.' }
            : cs === 'stale'
              ? { key: 'collector', label: 'Monitoring', status: 'warning', reason: 'The latest sample is older than expected.' }
              : { key: 'collector', label: 'Monitoring', status: 'warning', reason: 'The collector has stopped reporting. The server itself may still be running: check the provider status.' },
  );

  const open = (k: RuleKey) => i.rules[k]?.openedAt != null;
  const sev = (k: RuleKey): HealthStatus => (i.rules[k]?.severity === 'critical' ? 'critical' : 'warning');
  const perfRules: RuleKey[] = ['cpu', 'memory', 'swap', 'network_errors'];
  const perfOpen = perfRules.filter(open);
  dims.push(
    !measured || !i.latest
      ? { key: 'performance', label: 'Performance', status: 'unknown', reason: 'No guest metrics are available.' }
      : perfOpen.length
        ? { key: 'performance', label: 'Performance', status: perfOpen.map(sev).reduce((a, b) => (rank[a] >= rank[b] ? a : b)), reason: `Sustained pressure: ${perfOpen.join(', ').replace(/_/g, ' ')}.` }
        : { key: 'performance', label: 'Performance', status: 'ok', reason: 'CPU, memory and swap are within thresholds.' },
  );
  dims.push(
    !measured || i.latest?.diskMaxUsedPct == null
      ? { key: 'storage', label: 'Storage', status: 'unknown', reason: 'No filesystem metrics are available.' }
      : open('disk')
        ? { key: 'storage', label: 'Storage', status: sev('disk'), reason: `A filesystem is above ${i.rules.disk?.severity === 'critical' ? i.thresholds.diskCritPct : i.thresholds.diskWarnPct}% used.` }
        : { key: 'storage', label: 'Storage', status: 'ok', reason: `Highest filesystem use is ${Math.round(i.latest.diskMaxUsedPct)}%.` },
  );
  dims.push(
    !measured || (i.unhealthyServices === null && i.restartingContainers === null)
      ? { key: 'services', label: 'Services & containers', status: 'unknown', reason: 'No service or container data is reported.' }
      : (i.unhealthyServices ?? 0) > 0 || (i.restartingContainers ?? 0) > 0 || open('container_restarts')
        ? { key: 'services', label: 'Services & containers', status: 'warning', reason: `${i.unhealthyServices ?? 0} failed service(s), ${i.restartingContainers ?? 0} restarting container(s).` }
        : { key: 'services', label: 'Services & containers', status: 'ok', reason: 'Reported services and containers are healthy.' },
  );
  dims.push(
    i.billingOverdue
      ? { key: 'billing', label: 'Billing & renewal', status: 'critical', reason: 'A confirmed payment or expiry date has passed.' }
      : i.billingDaysRemaining === null
        ? { key: 'billing', label: 'Billing & renewal', status: 'unknown', reason: 'No confirmed renewal date is recorded.' }
        : i.billingDaysRemaining <= 7
          ? { key: 'billing', label: 'Billing & renewal', status: 'warning', reason: `Due in ${i.billingDaysRemaining} day(s).` }
          : { key: 'billing', label: 'Billing & renewal', status: 'ok', reason: `Next date is in ${i.billingDaysRemaining} days.` },
  );

  // Unknown never drags the verdict down: only measured problems do.
  const worst = dims.reduce<HealthStatus>((acc, d) => (rank[d.status] > rank[acc] ? d.status : acc), 'unknown');
  const known = dims.filter((d) => d.status !== 'unknown').length;
  return {
    overall: worst,
    confidence: measured && known >= 5 ? 'high' : known >= 3 ? 'medium' : 'low',
    dimensions: dims,
    collectorState: cs,
  };
}

/* ------------------------------------------------------------------ range */

export const RANGES = { '1h': 3600, '6h': 6 * 3600, '24h': 24 * 3600, '7d': 7 * 86_400, '30d': 30 * 86_400 } as const;
export type RangeKey = keyof typeof RANGES;

/** Bucket width keeps every chart under ~200 points regardless of range. */
export function bucketSeconds(range: RangeKey): number {
  return { '1h': 60, '6h': 120, '24h': 600, '7d': 3600, '30d': 14_400 }[range];
}

export function isRangeKey(v: string | undefined): v is RangeKey {
  return v !== undefined && v in RANGES;
}
