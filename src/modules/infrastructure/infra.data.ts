import { InfraAsset, InfraCollector, InfraSettings, InfraSslCertificate, InfraSubscription } from "../../models/infrastructure/infrastructure.models";
import { money, sid } from "./infra.util";
import type { AssetRow } from "./core/renewal-items";

/** The relational "asset with children" shape the report/renewal logic works on (ids as strings, money as numbers). */
export interface LoadedAsset {
  id: string;
  name: string;
  type: string;
  clientId: null;
  client: null;
  archivedAt: Date | null;
  technicalId: string | null;
  provider: string | null;
  environment: string;
  providerConnectionId: string | null;
  remoteId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  tags: string[];
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  server: any | null;
  domain: any | null;
  collector: { revokedAt: Date | null; lastSampleAt: Date | null } | null;
  subscriptions: any[];
  certificates: any[];
}

const nn = <T>(v: T | undefined | null): T | null => (v === undefined || v === null ? null : v);

export function subView(s: any) {
  return {
    id: sid(s._id), assetId: sid(s.assetId), kind: s.kind, label: nn(s.label), providerName: nn(s.providerName), billingAccount: nn(s.billingAccount), cycle: s.cycle,
    customIntervalMonths: nn(s.customIntervalMonths), currency: s.currency, amount: money(s.amount), autoRenew: s.autoRenew, paymentStatus: s.paymentStatus,
    lastPaymentDate: nn(s.lastPaymentDate), nextDueDate: nn(s.nextDueDate), renewalDate: nn(s.renewalDate), expirationDate: nn(s.expirationDate), graceDays: nn(s.graceDays),
    invoiceRef: nn(s.invoiceRef), notes: nn(s.notes), fieldSources: nn(s.fieldSources), archivedAt: nn(s.archivedAt), createdAt: s.createdAt,
  };
}

export function certRow(c: any) {
  return {
    id: sid(c._id), assetId: c.assetId ? sid(c.assetId) : null, hostname: c.hostname, port: c.port ?? 443, commonName: nn(c.commonName), sans: c.sans ?? [], issuer: nn(c.issuer),
    validFrom: nn(c.validFrom), validTo: nn(c.validTo), fingerprint: nn(c.fingerprint), trusted: c.trusted === undefined ? null : c.trusted, verifyError: nn(c.verifyError),
    autoRenew: c.autoRenew ?? "UNKNOWN", lastCheckedAt: nn(c.lastCheckedAt), lastSuccessAt: nn(c.lastSuccessAt), lastError: nn(c.lastError),
  };
}

function domainRow(id: string, d: any) {
  if (!d) return null;
  return {
    assetId: id, fqdn: d.fqdn, unicodeName: nn(d.unicodeName), tld: d.tld, registrar: nn(d.registrar), registeredAt: nn(d.registeredAt), registryExpiresAt: nn(d.registryExpiresAt),
    registrarExpiresAt: nn(d.registrarExpiresAt), rdapUpdatedAt: nn(d.rdapUpdatedAt), statuses: d.statuses ?? [], nameservers: d.nameservers ?? [], dnssec: d.dnssec === undefined ? null : d.dnssec,
    rdapSource: nn(d.rdapSource), rdapState: d.rdapState ?? "NEVER", rdapError: nn(d.rdapError), rdapCheckedAt: nn(d.rdapCheckedAt), dnsState: d.dnsState ?? "NEVER", dnsError: nn(d.dnsError),
    dnsCheckedAt: nn(d.dnsCheckedAt), alertsEnabled: d.alertsEnabled !== false,
  };
}

function serverRow(s: any) {
  if (!s) return null;
  const out: any = {};
  for (const k of ["serverType", "planName", "hostname", "ipv4", "ipv6", "region", "datacenter", "operatingSystem", "vcpu", "ramMb", "storageGb", "storageType", "providerStatus", "providerSuspended", "providerCreatedAt", "lastSyncedAt", "syncState"]) out[k] = nn(s[k]);
  out.additionalIps = s.additionalIps ?? [];
  out.networkInfo = s.networkInfo ?? null;
  return out;
}

/** Loads assets (lean docs) together with their non-archived subscriptions, certificates and collector state. */
export async function hydrateAssets(docs: any[], opts: { withSubscriptions?: boolean; withCertificates?: boolean; withCollector?: boolean } = {}): Promise<LoadedAsset[]> {
  const { withSubscriptions = true, withCertificates = true, withCollector = true } = opts;
  const ids = docs.map((d) => d._id);
  const [subs, certs, collectors] = await Promise.all([
    withSubscriptions && ids.length ? InfraSubscription.find({ assetId: { $in: ids }, archivedAt: null }).sort({ createdAt: 1 }).lean() : [],
    withCertificates && ids.length ? InfraSslCertificate.find({ assetId: { $in: ids } }).lean() : [],
    withCollector && ids.length ? InfraCollector.find({ assetId: { $in: ids } }).select("assetId revokedAt lastSampleAt").lean() : [],
  ]);
  const subBy = new Map<string, any[]>();
  for (const s of subs as any[]) subBy.set(sid(s.assetId), [...(subBy.get(sid(s.assetId)) ?? []), subView(s)]);
  const certBy = new Map<string, any[]>();
  for (const c of certs as any[]) certBy.set(sid(c.assetId), [...(certBy.get(sid(c.assetId)) ?? []), certRow(c)]);
  const colBy = new Map((collectors as any[]).map((c) => [sid(c.assetId), { revokedAt: c.revokedAt ?? null, lastSampleAt: c.lastSampleAt ?? null }]));
  return docs.map((d) => {
    const id = sid(d._id);
    return {
      id, name: d.name, type: d.type, clientId: null, client: null, archivedAt: d.archivedAt ?? null, technicalId: nn(d.technicalId), provider: nn(d.provider), environment: d.environment,
      providerConnectionId: d.providerConnectionId ? sid(d.providerConnectionId) : null, remoteId: nn(d.remoteId), ownerName: nn(d.ownerName), ownerEmail: nn(d.ownerEmail), tags: d.tags ?? [], notes: nn(d.notes),
      createdAt: d.createdAt, updatedAt: d.updatedAt, server: serverRow(d.server), domain: domainRow(id, d.domain), collector: colBy.get(id) ?? null,
      subscriptions: subBy.get(id) ?? [], certificates: certBy.get(id) ?? [],
    };
  });
}

export const asRows = (a: LoadedAsset[]): AssetRow[] => a as unknown as AssetRow[];

export async function loadActiveAssets(extra: Record<string, unknown> = {}, limit = 5000): Promise<LoadedAsset[]> {
  const docs = await InfraAsset.find({ archivedAt: null, ...extra }).limit(limit).lean();
  return hydrateAssets(docs);
}

/* ---------------------------------------------------------------- settings */

export async function getSettingsDoc(): Promise<any | null> {
  return InfraSettings.findOne({ key: "default" }).lean();
}

export async function upsertSettings(patch: Record<string, unknown>): Promise<void> {
  await InfraSettings.updateOne({ key: "default" }, { $set: patch, $setOnInsert: { key: "default" } }, { upsert: true });
}

export async function defaultCurrency(): Promise<string> {
  return (await getSettingsDoc())?.defaultCurrency ?? process.env.INFRA_DEFAULT_CURRENCY ?? "INR";
}
