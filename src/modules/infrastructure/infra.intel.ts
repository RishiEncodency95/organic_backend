import { InfraAsset, InfraDnsSnapshot, InfraSslCertificate, InfraSyncRun } from "../../models/infrastructure/infrastructure.models";
import { logger } from "../../utils/logger";
import { diffRecords, hashRecords, lookupDns, summarizeChanges, EMPTY_RECORDS, type DnsRecords } from "./core/dns-intel";
import { normalizeDomain } from "./core/domain-name";
import { lookupDomain } from "./core/rdap";
import { certificateState, probeCertificate } from "./core/ssl-intel";
import { raiseEvent } from "./infra.alerts";
import { E, errMsg, mapLimit, oid, sid } from "./infra.util";

const DNS_SNAPSHOT_KEEP_UNCHANGED_MS = 24 * 3_600_000;

async function run<T>(assetId: string | null, kind: string, trigger: string, work: () => Promise<{ status: "SUCCEEDED" | "PARTIAL" | "FAILED"; stats?: Record<string, unknown>; error?: string | null; value: T }>): Promise<T> {
  const row = await InfraSyncRun.create({ assetId: assetId ? oid(assetId) : null, kind, trigger, status: "RUNNING" });
  try {
    const result = await work();
    await InfraSyncRun.updateOne({ _id: row._id }, { $set: { status: result.status, finishedAt: new Date(), stats: result.stats ?? {}, error: result.error?.slice(0, 500) ?? null } });
    return result.value;
  } catch (e) {
    await InfraSyncRun.updateOne({ _id: row._id }, { $set: { status: "FAILED", finishedAt: new Date(), error: errMsg(e).slice(0, 500) } }).catch(() => undefined);
    throw e;
  }
}

async function domainOf(assetId: string) {
  const asset = await InfraAsset.findOne({ _id: oid(assetId), type: "DOMAIN" }).select("domain name").lean<any>();
  if (!asset?.domain) throw E.notFound("Domain not found.", "infra_asset_not_found");
  return asset;
}

/** Registry (RDAP) lookup. A failed lookup records the failure but never erases previously confirmed dates. */
export async function refreshRdap(assetId: string, trigger = "manual") {
  const asset = await domainOf(assetId);
  const norm = normalizeDomain(asset.domain.fqdn);
  if (!norm.ok) throw E.badRequest(norm.reason, "infra_invalid_domain");
  return run(assetId, "RDAP", trigger, async () => {
    const res = await lookupDomain(norm.value.ascii, norm.value.tld);
    const now = new Date();
    const set: Record<string, unknown> = { "domain.rdapState": res.state, "domain.rdapError": res.error, "domain.rdapCheckedAt": now, "domain.rdapSource": res.source };
    if (res.parsed && (res.state === "OK" || res.state === "NO_EXPIRY")) {
      const p = res.parsed;
      Object.assign(set, {
        "domain.registrar": p.registrar, "domain.registeredAt": p.registeredAt, "domain.registryExpiresAt": p.registryExpiresAt, "domain.registrarExpiresAt": p.registrarExpiresAt,
        "domain.rdapUpdatedAt": p.lastChangedAt, "domain.statuses": p.statuses, "domain.nameservers": p.nameservers, "domain.dnssec": p.dnssec,
      });
    }
    await InfraAsset.updateOne({ _id: asset._id }, { $set: set });
    const ok = res.state === "OK" || res.state === "NO_EXPIRY";
    return { status: ok ? "SUCCEEDED" : "FAILED", stats: { state: res.state }, error: ok ? null : res.error, value: { state: res.state as string, error: res.error } } as const;
  });
}

export async function refreshDns(assetId: string, trigger = "manual") {
  const asset = await domainOf(assetId);
  const fqdn: string = asset.domain.fqdn;
  return run(assetId, "DNS", trigger, async () => {
    const { records, errors } = await lookupDns(fqdn);
    const failedTypes = Object.keys(errors);
    const total = 8;
    const state = failedTypes.length === 0 ? "OK" : failedTypes.length >= total ? "ERROR" : "PARTIAL";
    const previous = await InfraDnsSnapshot.findOne({ domainId: asset._id }).sort({ checkedAt: -1 }).lean<any>();
    const hash = hashRecords(records);
    let changes: ReturnType<typeof diffRecords> = [];
    if (previous) {
      const prevErrors = Object.keys((previous.lookupErrors ?? {}) as Record<string, string>);
      changes = diffRecords(previous.records as DnsRecords, records, [...failedTypes, ...prevErrors]);
    }
    const changed = changes.length > 0;
    const stale = !previous || Date.now() - new Date(previous.checkedAt).getTime() > DNS_SNAPSHOT_KEEP_UNCHANGED_MS;
    if (state !== "ERROR" && (changed || stale)) {
      await InfraDnsSnapshot.create({ domainId: asset._id, records, recordHash: hash, changed, changes, lookupErrors: errors });
    }
    await InfraAsset.updateOne({ _id: asset._id }, { $set: { "domain.dnsState": state, "domain.dnsError": failedTypes.length ? `Lookup failed for: ${failedTypes.join(", ")}` : null, "domain.dnsCheckedAt": new Date() } });
    if (changed && previous) {
      // Notification text carries record TYPES and counts only: never TXT contents or tokens.
      await raiseEvent({
        assetId, kind: "DNS_CHANGE", severity: "warning", dedupeKey: `DNS_CHANGE:${assetId}:${hash.slice(0, 16)}`,
        title: `DNS records changed for ${fqdn}`,
        message: `DNS changes were detected (${summarizeChanges(changes)}). Review the change history on the domain page.`,
      }).catch((e) => logger.warn(`infra.dns_alert_failed: ${errMsg(e, "unknown")}`));
    }
    return { status: state === "OK" ? "SUCCEEDED" : state === "PARTIAL" ? "PARTIAL" : "FAILED", stats: { changed, failedTypes }, error: state === "ERROR" ? "DNS lookup failed for every record type." : null, value: { state, changed, changes, records: previous || state !== "ERROR" ? records : EMPTY_RECORDS, errors } } as const;
  });
}

export async function refreshCertificate(certificateId: string, trigger = "manual") {
  const cert = await InfraSslCertificate.findById(oid(certificateId, "certificate id")).lean<any>();
  if (!cert) throw E.notFound("Certificate not found.", "infra_cert_not_found");
  return run(cert.assetId ? sid(cert.assetId) : null, "SSL", trigger, async () => {
    const res = await probeCertificate(cert.hostname, cert.port);
    const now = new Date();
    if (res.ok && res.certificate) {
      const c = res.certificate;
      await InfraSslCertificate.updateOne({ _id: cert._id }, { $set: { commonName: c.commonName, sans: c.sans, issuer: c.issuer, validFrom: c.validFrom, validTo: c.validTo, fingerprint: c.fingerprint, trusted: res.trusted, verifyError: res.verifyError, lastCheckedAt: now, lastSuccessAt: now, lastError: null } });
      return { status: "SUCCEEDED", stats: { state: certificateState(c.validTo, now).state, trusted: res.trusted }, value: { ok: true as boolean, error: null as string | null } } as const;
    }
    // A failed probe keeps the last known certificate: an outage must not look like an expiry.
    await InfraSslCertificate.updateOne({ _id: cert._id }, { $set: { lastCheckedAt: now, lastError: res.error } });
    return { status: "FAILED", stats: {}, error: res.error, value: { ok: false, error: res.error } } as const;
  });
}

/** Registry + DNS + every certificate for one domain. Each step is independent: one failing does not stop the others. */
export async function refreshDomain(assetId: string, trigger = "manual") {
  const rdap = await refreshRdap(assetId, trigger).catch((e) => ({ state: "ERROR", error: errMsg(e) }));
  const dns = await refreshDns(assetId, trigger).then((r) => ({ state: r.state, changed: r.changed })).catch((e) => ({ state: "ERROR", error: errMsg(e) }));
  await ensureDefaultCertificate(assetId).catch(() => undefined);
  const certs = await InfraSslCertificate.find({ assetId: oid(assetId) }).select("_id").lean<any[]>();
  const ssl = await mapLimit(certs, 3, (c) => refreshCertificate(sid(c._id), trigger).catch((e) => ({ ok: false, error: errMsg(e) })));
  return { rdap, dns, ssl };
}

/**
 * Adds a certificate target. The hostname must be the domain itself or a subdomain of a domain already in the
 * inventory, so the probe endpoint can never be pointed at an arbitrary host.
 */
export async function addCertificate(assetId: string, hostnameInput: string, port = 443, probe = true): Promise<string> {
  const asset = await domainOf(assetId);
  const fqdn: string = asset.domain.fqdn;
  const norm = normalizeDomain(hostnameInput);
  if (!norm.ok) throw E.badRequest(norm.reason, "infra_invalid_domain");
  const host = norm.value.ascii;
  if (host !== fqdn && !host.endsWith(`.${fqdn}`)) throw E.badRequest(`The hostname must be ${fqdn} or one of its subdomains.`, "infra_host_outside_domain");
  const cert = await InfraSslCertificate.findOneAndUpdate({ hostname: host, port }, { $set: { assetId: asset._id } }, { upsert: true, new: true }).lean<any>();
  if (probe) await refreshCertificate(sid(cert._id), "manual").catch(() => undefined);
  return sid(cert._id);
}

/** Domains are auto-monitored for TLS at the apex; a one-time default so SSL data exists without extra setup. */
export async function ensureDefaultCertificate(assetId: string): Promise<string | null> {
  const asset = await InfraAsset.findOne({ _id: oid(assetId), type: "DOMAIN" }).select("domain.fqdn").lean<any>();
  if (!asset?.domain) return null;
  const existing = await InfraSslCertificate.findOne({ assetId: asset._id }).select("_id").lean<any>();
  return existing ? sid(existing._id) : addCertificate(assetId, asset.domain.fqdn, 443, false);
}
