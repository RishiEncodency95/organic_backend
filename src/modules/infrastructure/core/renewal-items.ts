import { daysBetween, nextCycleDate, startOfUtcDay, type BillingCycle } from './billing-math';
import { certificateState } from './ssl-intel';

export type RenewalKind = 'payment_due' | 'service_expiry' | 'domain_expiry' | 'ssl_expiry';
export type DateSource = 'manual' | 'rdap' | 'provider_api' | 'tls_probe' | 'projected';

export interface RenewalItem {
  key: string;
  assetId: string;
  assetName: string;
  assetType: string;
  clientId: string | null;
  kind: RenewalKind;
  date: Date;
  daysRemaining: number;
  source: DateSource;
  verified: boolean;
  subscriptionId: string | null;
  amount: number | null;
  currency: string | null;
  paymentStatus: string | null;
  label: string;
}

export interface SubRow {
  id: string;
  kind: string;
  label: string | null;
  providerName: string | null;
  cycle: BillingCycle;
  customIntervalMonths: number | null;
  currency: string;
  amount: unknown;
  paymentStatus: string;
  lastPaymentDate: Date | null;
  nextDueDate: Date | null;
  renewalDate: Date | null;
  expirationDate: Date | null;
  fieldSources: unknown;
  archivedAt: Date | null;
}

export interface AssetRow {
  id: string;
  name: string;
  type: string;
  clientId: string | null;
  archivedAt: Date | null;
  technicalId: string | null;
  domain: { registryExpiresAt: Date | null; registrarExpiresAt: Date | null; alertsEnabled: boolean } | null;
  subscriptions: SubRow[];
  certificates: Array<{ id: string; hostname: string; validTo: Date | null }>;
}

type Sources = Record<string, { source?: string; verifiedAt?: string } | number | undefined> | null;
const sources = (s: unknown): Sources => (s && typeof s === 'object' ? (s as Sources) : null);
const fieldSource = (s: unknown, field: string): { source?: string } | null => {
  const v = sources(s)?.[field];
  return v && typeof v === 'object' ? v : null;
};

export function anchorDayOf(fieldSources: unknown): number | null {
  const v = sources(fieldSources)?.anchorDay;
  return typeof v === 'number' ? v : null;
}
export function effectiveDomainExpiry(
  domain: { registryExpiresAt: Date | null; registrarExpiresAt: Date | null } | null,
  subs: Array<Pick<SubRow, 'kind' | 'expirationDate' | 'fieldSources' | 'archivedAt'>>,
): { date: Date | null; source: DateSource | 'unknown'; verified: boolean } {
  const override = subs.find((s) => s.kind === 'DOMAIN_REGISTRATION' && !s.archivedAt && s.expirationDate && fieldSource(s.fieldSources, 'expirationDate')?.source === 'manual');
  if (override?.expirationDate) return { date: override.expirationDate, source: 'manual', verified: true };
  if (domain?.registryExpiresAt) return { date: domain.registryExpiresAt, source: 'rdap', verified: true };
  if (domain?.registrarExpiresAt) return { date: domain.registrarExpiresAt, source: 'rdap', verified: true };
  return { date: null, source: 'unknown', verified: false };
}

export function buildRenewalItems(assets: AssetRow[], now: Date): RenewalItem[] {
  const today = startOfUtcDay(now);
  const items: RenewalItem[] = [];
  for (const a of assets) {
    if (a.archivedAt) continue;
    const base = { assetId: a.id, assetName: a.name, assetType: a.type, clientId: a.clientId };
    for (const s of a.subscriptions) {
      if (s.archivedAt) continue;
      const amount = s.amount === null || s.amount === undefined ? null : Number(s.amount);
      const common = { ...base, subscriptionId: s.id, amount, currency: s.currency, paymentStatus: s.paymentStatus };
      const label = s.label || s.providerName || s.kind.replace(/_/g, ' ').toLowerCase();
      const dueSource = fieldSource(s.fieldSources, 'nextDueDate');
      if (s.nextDueDate) {
        items.push({ ...common, key: `${s.id}:due`, kind: 'payment_due', date: s.nextDueDate, daysRemaining: daysBetween(today, s.nextDueDate), source: dueSource?.source === 'provider_api' ? 'provider_api' : 'manual', verified: Boolean(dueSource), label });
      } else if (s.lastPaymentDate) {
        const projected = nextCycleDate(s.lastPaymentDate, s.cycle, s.customIntervalMonths, anchorDayOf(s.fieldSources));
        if (projected) items.push({ ...common, key: `${s.id}:projected`, kind: 'payment_due', date: projected, daysRemaining: daysBetween(today, projected), source: 'projected', verified: false, label });
      }
      if (s.expirationDate && s.kind !== 'DOMAIN_REGISTRATION') {
        items.push({ ...common, key: `${s.id}:exp`, kind: 'service_expiry', date: s.expirationDate, daysRemaining: daysBetween(today, s.expirationDate), source: 'manual', verified: Boolean(fieldSource(s.fieldSources, 'expirationDate')), label });
      }
    }
    if (a.type === 'DOMAIN') {
      const eff = effectiveDomainExpiry(a.domain, a.subscriptions);
      if (eff.date) {
        items.push({ ...base, key: `${a.id}:domain`, kind: 'domain_expiry', date: eff.date, daysRemaining: daysBetween(today, eff.date), source: eff.source === 'unknown' ? 'rdap' : eff.source, verified: eff.verified, subscriptionId: null, amount: null, currency: null, paymentStatus: null, label: a.technicalId ?? a.name });
      }
    }
    for (const c of a.certificates) {
      if (!c.validTo) continue;
      items.push({ ...base, key: `${c.id}:ssl`, kind: 'ssl_expiry', date: c.validTo, daysRemaining: certificateState(c.validTo, now).daysRemaining ?? 0, source: 'tls_probe', verified: true, subscriptionId: null, amount: null, currency: null, paymentStatus: null, label: c.hostname });
    }
  }
  return items.sort((x, y) => x.date.getTime() - y.date.getTime());
}

export function unknownRenewalAssets(assets: AssetRow[], items: RenewalItem[]): AssetRow[] {
  const known = new Set(items.filter((i) => i.kind !== 'ssl_expiry' && i.source !== 'projected').map((i) => i.assetId));
  return assets.filter((a) => !a.archivedAt && ['SERVER', 'DOMAIN', 'HOSTING'].includes(a.type) && !known.has(a.id));
}
