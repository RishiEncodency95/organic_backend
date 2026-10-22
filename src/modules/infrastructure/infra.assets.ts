import { isIP } from "node:net";
import { InfraAlert, InfraAsset, InfraAssetRelation, InfraAuditEvent, InfraBillingRecord, InfraCollector, InfraDnsSnapshot, InfraMetricSample, InfraProviderConnection, InfraSslCertificate, InfraSubscription, InfraSyncRun } from "../../models/infrastructure/infrastructure.models";
import { logger } from "../../utils/logger";
import { emailPosture, redactForViewer, type DnsRecords } from "./core/dns-intel";
import { normalizeDomain } from "./core/domain-name";
import { effectiveDomainExpiry } from "./core/renewal-items";
import { certificateState } from "./core/ssl-intel";
import { certRow, hydrateAssets, type LoadedAsset } from "./infra.data";
import { refreshDomain } from "./infra.intel";
import { audit, E, errMsg, INFRA_ACTIONS, INFRA_RESOURCE, isoDate, isoTime, money, oid, sid, type InfraActor } from "./infra.util";

const SORTS: Record<string, Record<string, 1 | -1>> = {
  name: { name: 1 }, "-name": { name: -1 }, created: { createdAt: 1 }, "-created": { createdAt: -1 }, updated: { updatedAt: 1 }, "-updated": { updatedAt: -1 },
};

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function normalizeTags(tags?: string[]): string[] {
  return [...new Set((tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
}

/* ---------------------------------------------------------------- views */

export function subscriptionView(s: any, canBilling: boolean) {
  const sources = (s.fieldSources ?? {}) as Record<string, unknown>;
  return {
    id: s.id, kind: s.kind, label: s.label, providerName: s.providerName, cycle: s.cycle, customIntervalMonths: s.customIntervalMonths, autoRenew: s.autoRenew,
    lastPaymentDate: isoDate(s.lastPaymentDate), nextDueDate: isoDate(s.nextDueDate), renewalDate: isoDate(s.renewalDate), expirationDate: isoDate(s.expirationDate), graceDays: s.graceDays,
    dateSources: { nextDueDate: sources.nextDueDate ?? null, renewalDate: sources.renewalDate ?? null, expirationDate: sources.expirationDate ?? null, lastPaymentDate: sources.lastPaymentDate ?? null },
    // Private billing data: only for members with billing view permission.
    ...(canBilling
      ? { currency: s.currency, amount: s.amount, paymentStatus: s.paymentStatus, invoiceRef: s.invoiceRef, billingAccount: s.billingAccount, notes: s.notes }
      : { currency: null, amount: null, paymentStatus: null, invoiceRef: null, billingAccount: null, notes: null, billingHidden: true }),
  };
}

export function certView(c: ReturnType<typeof certRow>, now = new Date()) {
  const st = certificateState(c.validTo, now);
  return {
    id: c.id, assetId: c.assetId, hostname: c.hostname, port: c.port, commonName: c.commonName, sans: c.sans, issuer: c.issuer, validFrom: isoTime(c.validFrom), validTo: isoTime(c.validTo),
    daysRemaining: st.daysRemaining, state: c.lastCheckedAt ? st.state : "UNKNOWN", trusted: c.trusted, verifyError: c.verifyError, autoRenew: c.autoRenew,
    lastCheckedAt: isoTime(c.lastCheckedAt), lastSuccessAt: isoTime(c.lastSuccessAt), lastError: c.lastError,
  };
}

export async function connectionRef(a: LoadedAsset): Promise<{ id: string; provider: string; label: string } | null> {
  if (!a.providerConnectionId) return null;
  const c = await InfraProviderConnection.findById(a.providerConnectionId).select("provider label").lean<any>();
  return c ? { id: sid(c._id), provider: c.provider, label: c.label } : null;
}

export function assetView(a: LoadedAsset, canBilling: boolean, connection: { id: string; provider: string; label: string } | null) {
  const expiry = a.domain ? effectiveDomainExpiry(a.domain, a.subscriptions as never) : null;
  const now = new Date();
  return {
    id: a.id, type: a.type, name: a.name, technicalId: a.technicalId, environment: a.environment, provider: a.provider, connection, remoteId: a.remoteId,
    source: a.providerConnectionId ? "provider_api" : "manual", client: null, shared: true, ownerName: a.ownerName, ownerEmail: a.ownerEmail, tags: a.tags, notes: a.notes,
    archivedAt: isoTime(a.archivedAt), createdAt: isoTime(a.createdAt), updatedAt: isoTime(a.updatedAt),
    server: a.server && {
      serverType: a.server.serverType, planName: a.server.planName, hostname: a.server.hostname, ipv4: a.server.ipv4, ipv6: a.server.ipv6, additionalIps: a.server.additionalIps ?? [], region: a.server.region,
      datacenter: a.server.datacenter, operatingSystem: a.server.operatingSystem, vcpu: a.server.vcpu, ramMb: a.server.ramMb, storageGb: a.server.storageGb, storageType: a.server.storageType,
      networkInfo: a.server.networkInfo ?? null, providerStatus: a.server.providerStatus, providerSuspended: a.server.providerSuspended, providerCreatedAt: isoTime(a.server.providerCreatedAt),
      lastSyncedAt: isoTime(a.server.lastSyncedAt), syncState: a.server.syncState,
    },
    domain: a.domain && {
      fqdn: a.domain.fqdn, unicodeName: a.domain.unicodeName, tld: a.domain.tld, registrar: a.domain.registrar, registeredAt: isoTime(a.domain.registeredAt), registryExpiresAt: isoTime(a.domain.registryExpiresAt),
      registrarExpiresAt: isoTime(a.domain.registrarExpiresAt), rdapUpdatedAt: isoTime(a.domain.rdapUpdatedAt), statuses: a.domain.statuses, nameservers: a.domain.nameservers, dnssec: a.domain.dnssec,
      rdapSource: a.domain.rdapSource, rdapState: a.domain.rdapState, rdapError: a.domain.rdapError, rdapCheckedAt: isoTime(a.domain.rdapCheckedAt), dnsState: a.domain.dnsState, dnsError: a.domain.dnsError,
      dnsCheckedAt: isoTime(a.domain.dnsCheckedAt), alertsEnabled: a.domain.alertsEnabled, effectiveExpiry: expiry && { date: isoTime(expiry.date), source: expiry.source, verified: expiry.verified },
    },
    certificates: a.certificates.map((c) => certView(c, now)),
    subscriptions: a.subscriptions.map((s) => subscriptionView(s, canBilling)),
  };
}

async function viewMany(docs: any[], canBilling: boolean) {
  const loaded = await hydrateAssets(docs);
  const connIds = [...new Set(loaded.map((a) => a.providerConnectionId).filter(Boolean))] as string[];
  const conns = connIds.length ? await InfraProviderConnection.find({ _id: { $in: connIds } }).select("provider label").lean<any[]>() : [];
  const byId = new Map(conns.map((c) => [sid(c._id), { id: sid(c._id), provider: c.provider, label: c.label }]));
  return loaded.map((a) => assetView(a, canBilling, a.providerConnectionId ? byId.get(a.providerConnectionId) ?? null : null));
}

/* ----------------------------------------------------------------- list */

export async function listAssets(q: Record<string, string | undefined>, canBilling: boolean, forcedType?: "SERVER" | "DOMAIN") {
  const and: Record<string, unknown>[] = [];
  const type = forcedType ?? q.type;
  if (type) and.push({ type });
  if (q.environment) and.push({ environment: q.environment });
  if (q.provider) and.push({ provider: q.provider });
  and.push(q.archived === "true" ? { archivedAt: { $ne: null } } : { archivedAt: null });
  if (q.q?.trim()) {
    const term = q.q.trim().slice(0, 100);
    const rx = new RegExp(escapeRegex(term), "i");
    and.push({ $or: [{ name: rx }, { technicalId: rx }, { tags: term.toLowerCase() }, { "server.ipv4": new RegExp(escapeRegex(term)) }, { "domain.registrar": rx }] });
  }
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 25));
  const where = and.length ? { $and: and } : {};
  const [total, rows] = await Promise.all([
    InfraAsset.countDocuments(where),
    InfraAsset.find(where).sort({ ...(SORTS[q.sort ?? ""] ?? { createdAt: -1 }), _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { items: await viewMany(rows, canBilling), total, page, limit };
}

export async function getAsset(id: string, canBilling: boolean, canSeeSensitive: boolean) {
  const _id = oid(id, "asset id");
  const row = await InfraAsset.findById(_id).lean<any>();
  if (!row) throw E.notFound("Asset not found.", "infra_asset_not_found");
  const [view] = await viewMany([row], canBilling);
  const [relations, snapshots, runs, events, records] = await Promise.all([
    InfraAssetRelation.find({ $or: [{ fromAssetId: _id }, { toAssetId: _id }] }).lean<any[]>(),
    row.domain ? InfraDnsSnapshot.find({ domainId: _id }).sort({ checkedAt: -1 }).limit(20).lean<any[]>() : Promise.resolve([] as any[]),
    InfraSyncRun.find({ $or: [{ assetId: _id }, ...(row.providerConnectionId ? [{ connectionId: row.providerConnectionId }] : [])] }).sort({ startedAt: -1 }).limit(15).lean<any[]>(),
    InfraAuditEvent.find({ resourceType: INFRA_RESOURCE.ASSET, resourceId: id }).sort({ createdAt: -1 }).limit(30).lean<any[]>(),
    canBilling ? InfraBillingRecord.find({ assetId: _id }).sort({ createdAt: -1 }).limit(50).lean<any[]>() : Promise.resolve([] as any[]),
  ]);
  const otherIds = relations.map((r) => (sid(r.fromAssetId) === id ? r.toAssetId : r.fromAssetId));
  const others = otherIds.length ? await InfraAsset.find({ _id: { $in: otherIds } }).select("name type technicalId").lean<any[]>() : [];
  const otherBy = new Map(others.map((o) => [sid(o._id), { id: sid(o._id), name: o.name, type: o.type, technicalId: o.technicalId ?? null, clientId: null }]));
  return {
    ...view,
    relations: relations
      .filter((r) => otherBy.has(sid(sid(r.fromAssetId) === id ? r.toAssetId : r.fromAssetId)))
      .map((r) => ({ id: sid(r._id), kind: r.kind, direction: sid(r.fromAssetId) === id ? "out" : "in", asset: otherBy.get(sid(sid(r.fromAssetId) === id ? r.toAssetId : r.fromAssetId)) })),
    linkedWebsites: [] as unknown[],
    dnsPosture: snapshots[0] ? emailPosture(snapshots[0].records as DnsRecords) : null,
    dnsHistory: snapshots.map((s) => ({ id: sid(s._id), checkedAt: isoTime(s.checkedAt), changed: s.changed, changes: s.changes ?? [], errors: s.lookupErrors ?? {}, records: redactForViewer(s.records as DnsRecords, canSeeSensitive) })),
    syncHistory: runs.map((r) => ({ id: sid(r._id), kind: r.kind, status: r.status, trigger: r.trigger, startedAt: isoTime(r.startedAt), finishedAt: isoTime(r.finishedAt), stats: r.stats ?? null, error: r.error ?? null })),
    activity: events.map((e) => ({ id: sid(e._id), action: e.action, outcome: e.outcome, actor: e.actorType === "SYSTEM" ? "System" : "Team member", at: isoTime(e.createdAt) })),
    billingHistory: records.map((r) => ({ id: sid(r._id), kind: r.kind, coversDueDate: isoDate(r.coversDueDate), paidAt: isoDate(r.paidAt), amount: money(r.amount), currency: r.currency, invoiceRef: r.invoiceRef ?? null, note: r.note ?? null, source: r.source, createdAt: isoTime(r.createdAt) })),
  };
}

/* --------------------------------------------------------------- create */

function validateServerIps(dto: { ipv4?: string | null; ipv6?: string | null }) {
  if (dto.ipv4 && isIP(dto.ipv4) !== 4) throw E.badRequest("IPv4 address is not valid.", "infra_invalid_ipv4");
  if (dto.ipv6 && isIP(dto.ipv6) !== 6) throw E.badRequest("IPv6 address is not valid.", "infra_invalid_ipv6");
}

const orNull = <T>(v: T | undefined | null): T | null => (v === undefined ? null : v);

export async function createServer(actor: InfraActor, dto: any, canBilling: boolean) {
  validateServerIps(dto);
  const doc = await InfraAsset.create({
    type: "SERVER", name: dto.name.trim(), technicalId: dto.hostname?.trim() || dto.ipv4 || undefined, environment: dto.environment ?? "PRODUCTION", provider: dto.provider ?? undefined,
    ownerName: dto.ownerName ?? undefined, ownerEmail: dto.ownerEmail?.toLowerCase(), tags: normalizeTags(dto.tags), notes: dto.notes ?? undefined, createdByUserId: actor.userId,
    server: {
      serverType: dto.serverType ?? "VPS", planName: orNull(dto.planName) ?? undefined, hostname: dto.hostname?.trim() || undefined, ipv4: dto.ipv4 ?? undefined, ipv6: dto.ipv6 ?? undefined, region: dto.region ?? undefined,
      datacenter: dto.datacenter ?? undefined, operatingSystem: dto.operatingSystem ?? undefined, vcpu: dto.vcpu ?? undefined, ramMb: dto.ramMb ?? undefined, storageGb: dto.storageGb ?? undefined, storageType: dto.storageType ?? undefined, syncState: "MANUAL",
    },
  });
  await audit(actor, { action: INFRA_ACTIONS.ASSET_CREATED, resourceType: INFRA_RESOURCE.ASSET, resourceId: doc._id, metadata: { type: "SERVER", provider: dto.provider ?? null } });
  return (await viewMany([doc.toObject()], canBilling))[0];
}

export async function createDomain(actor: InfraActor, dto: any, canBilling: boolean) {
  const norm = normalizeDomain(dto.domain);
  if (!norm.ok) throw E.badRequest(norm.reason, "infra_invalid_domain");
  const existing = await InfraAsset.findOne({ "domain.fqdn": norm.value.ascii }).select("archivedAt").lean<any>();
  if (existing) {
    throw E.conflict(existing.archivedAt ? "This domain is archived. Restore it instead of adding it again." : "This domain is already in your inventory.", existing.archivedAt ? "infra_domain_archived" : "infra_domain_exists", { assetId: sid(existing._id) });
  }
  let doc: any;
  try {
    doc = await InfraAsset.create({
      type: "DOMAIN", name: dto.name?.trim() || norm.value.unicode, technicalId: norm.value.ascii, environment: dto.environment ?? "PRODUCTION", ownerName: dto.ownerName ?? undefined,
      ownerEmail: dto.ownerEmail?.toLowerCase(), tags: normalizeTags(dto.tags), notes: dto.notes ?? undefined, createdByUserId: actor.userId,
      domain: { fqdn: norm.value.ascii, unicodeName: norm.value.unicode, tld: norm.value.tld, alertsEnabled: dto.alertsEnabled ?? true },
    });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw E.conflict("This domain is already in your inventory.", "infra_domain_exists");
    throw e;
  }
  await audit(actor, { action: INFRA_ACTIONS.ASSET_CREATED, resourceType: INFRA_RESOURCE.ASSET, resourceId: doc._id, metadata: { type: "DOMAIN" } });
  // First registry/DNS read happens in the background; the response never waits on a third-party registry.
  void refreshDomain(sid(doc._id), "manual").catch((e) => logger.warn(`infra.initial_refresh_failed: ${errMsg(e, "unknown")}`));
  return (await viewMany([doc.toObject()], canBilling))[0];
}

export async function bulkCreateDomains(actor: InfraActor, dto: { domains: string[]; environment?: string }, canBilling: boolean) {
  const seen = new Set<string>();
  const results: Array<{ input: string; status: "created" | "duplicate" | "invalid"; message?: string; assetId?: string }> = [];
  for (const raw of dto.domains) {
    const norm = normalizeDomain(raw);
    if (!norm.ok) { results.push({ input: raw, status: "invalid", message: norm.reason }); continue; }
    if (seen.has(norm.value.ascii)) { results.push({ input: raw, status: "duplicate", message: "Listed more than once." }); continue; }
    seen.add(norm.value.ascii);
    try {
      const created = await createDomain(actor, { domain: norm.value.ascii, environment: dto.environment }, canBilling);
      results.push({ input: raw, status: "created", assetId: created.id });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "infra_domain_exists" || code === "infra_domain_archived") results.push({ input: raw, status: "duplicate", message: (e as Error).message });
      else if (code) results.push({ input: raw, status: "invalid", message: (e as Error).message });
      else throw e;
    }
  }
  return { results, created: results.filter((r) => r.status === "created").length };
}

/* --------------------------------------------------------------- update */

async function findAsset(id: string) {
  const row = await InfraAsset.findById(oid(id, "asset id")).lean<any>();
  if (!row) throw E.notFound("Asset not found.", "infra_asset_not_found");
  return row;
}

export async function updateAsset(actor: InfraActor, id: string, dto: any, canBilling: boolean) {
  const row = await findAsset(id);
  if (row.type === "SERVER") validateServerIps(dto);
  const imported = Boolean(row.providerConnectionId);
  const set: Record<string, unknown> = {};
  if (dto.name !== undefined) set.name = dto.name.trim();
  if (dto.environment) set.environment = dto.environment;
  if (dto.provider !== undefined && !imported) set.provider = dto.provider;
  if (dto.ownerName !== undefined) set.ownerName = dto.ownerName;
  if (dto.ownerEmail !== undefined) set.ownerEmail = dto.ownerEmail?.toLowerCase() ?? null;
  if (dto.tags !== undefined) set.tags = normalizeTags(dto.tags);
  if (dto.notes !== undefined) set.notes = dto.notes;
  if (row.type === "SERVER" && row.server && !imported) {
    // Provider-synced fields are owned by the provider; only manual servers have their configuration edited here.
    for (const k of ["serverType", "planName", "hostname", "ipv4", "ipv6", "region", "datacenter", "operatingSystem", "vcpu", "ramMb", "storageGb", "storageType"]) {
      if (dto[k] !== undefined) set[`server.${k}`] = dto[k];
    }
  }
  if (row.type === "DOMAIN" && dto.alertsEnabled !== undefined) set["domain.alertsEnabled"] = dto.alertsEnabled;
  if (Object.keys(set).length) await InfraAsset.updateOne({ _id: row._id }, { $set: set });
  await audit(actor, { action: INFRA_ACTIONS.ASSET_UPDATED, resourceType: INFRA_RESOURCE.ASSET, resourceId: id, metadata: { fields: Object.keys(dto) } });
  const fresh = await InfraAsset.findById(row._id).lean<any>();
  return (await viewMany([fresh], canBilling))[0];
}

export async function setArchived(actor: InfraActor, id: string, archived: boolean) {
  const row = await findAsset(id);
  await InfraAsset.updateOne({ _id: row._id }, { $set: { archivedAt: archived ? new Date() : null } });
  if (archived) await InfraAlert.updateMany({ assetId: row._id, state: { $in: ["OPEN", "ACKNOWLEDGED", "SNOOZED"] } }, { $set: { state: "RESOLVED", resolvedAt: new Date() } });
  await audit(actor, { action: archived ? INFRA_ACTIONS.ASSET_ARCHIVED : INFRA_ACTIONS.ASSET_RESTORED, resourceType: INFRA_RESOURCE.ASSET, resourceId: id });
  return { id, archived };
}

/** Permanent delete is refused while payment history exists, so financial records are never destroyed by accident. */
export async function removeAsset(actor: InfraActor, id: string) {
  const row = await findAsset(id);
  if (!row.archivedAt) throw E.conflict("Archive this asset before deleting it.", "infra_archive_first");
  const history = await InfraBillingRecord.countDocuments({ assetId: row._id });
  if (history > 0) throw E.conflict("This asset has payment history and can only stay archived.", "infra_has_billing_history");
  // Children are removed with the asset (the relational design cascaded these deletes).
  await Promise.all([
    InfraSubscription.deleteMany({ assetId: row._id }), InfraAlert.deleteMany({ assetId: row._id }), InfraCollector.deleteMany({ assetId: row._id }),
    InfraAssetRelation.deleteMany({ $or: [{ fromAssetId: row._id }, { toAssetId: row._id }] }), InfraDnsSnapshot.deleteMany({ domainId: row._id }),
    InfraSslCertificate.deleteMany({ assetId: row._id }),
  ]);
  await InfraMetricSample.deleteMany({ assetId: row._id });
  await InfraAsset.deleteOne({ _id: row._id });
  await audit(actor, { action: INFRA_ACTIONS.ASSET_DELETED, resourceType: INFRA_RESOURCE.ASSET, resourceId: id, metadata: { type: row.type } });
  return { id, deleted: true };
}

export async function linkAssets(actor: InfraActor, fromId: string, toId: string, kind: string) {
  if (fromId === toId) throw E.badRequest("An asset cannot be linked to itself.", "infra_self_link");
  const from = await findAsset(fromId);
  const to = await InfraAsset.findById(oid(toId, "asset id")).select("_id").lean<any>();
  if (!to) throw E.notFound("The linked asset was not found.", "infra_asset_not_found");
  try {
    const rel = await InfraAssetRelation.create({ fromAssetId: from._id, toAssetId: to._id, kind });
    await audit(actor, { action: INFRA_ACTIONS.ASSET_LINKED, resourceType: INFRA_RESOURCE.ASSET, resourceId: fromId, metadata: { kind, toAssetId: toId } });
    return { id: sid(rel._id) };
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw E.conflict("These assets are already linked.", "infra_already_linked");
    throw e;
  }
}

export async function unlinkAssets(actor: InfraActor, assetId: string, relationId: string) {
  await findAsset(assetId);
  const result = await InfraAssetRelation.deleteOne({ _id: oid(relationId, "relation id"), $or: [{ fromAssetId: oid(assetId) }, { toAssetId: oid(assetId) }] });
  if (!result.deletedCount) throw E.notFound("Link not found.", "infra_link_not_found");
  await audit(actor, { action: INFRA_ACTIONS.ASSET_LINKED, resourceType: INFRA_RESOURCE.ASSET, resourceId: assetId, metadata: { removed: true } });
  return { removed: true };
}

export async function requireAsset(id: string) {
  const row = await InfraAsset.findById(oid(id, "asset id")).select("type archivedAt technicalId").lean<any>();
  if (!row) throw E.notFound("Asset not found.", "infra_asset_not_found");
  return { id: sid(row._id), type: row.type as string, archivedAt: row.archivedAt ?? null, technicalId: row.technicalId ?? null };
}
