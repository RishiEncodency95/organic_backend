import { InfraAsset, InfraProviderConnection, InfraSyncRun } from "../../models/infrastructure/infrastructure.models";
import { logger } from "../../utils/logger";
import { ProviderError, type ProviderAdapter, type RemoteServer } from "./core/providers/provider.types";
import { ProviderRegistry } from "./core/providers/registry";
import { decryptSecret, encryptSecret } from "./infra.crypto";
import { audit, E, INFRA_ACTIONS, INFRA_RESOURCE, isoTime, oid, sid, type InfraActor } from "./infra.util";

export const providerRegistry = new ProviderRegistry();

const SERVER_FIELDS = (s: RemoteServer) => ({
  serverType: s.serverType, planName: s.planName, hostname: s.hostname, ipv4: s.ipv4, ipv6: s.ipv6, additionalIps: s.additionalIps, region: s.region, datacenter: s.datacenter,
  operatingSystem: s.operatingSystem, vcpu: s.vcpu, ramMb: s.ramMb, storageGb: s.storageGb, storageType: s.storageType, networkInfo: { providerReported: s.providerReported },
  providerStatus: s.providerStatus, providerCreatedAt: s.providerCreatedAt,
});

function view(c: any, imported: number) {
  const adapter = providerRegistry.get(c.provider);
  return {
    id: sid(c._id), provider: c.provider, providerLabel: adapter?.label ?? c.provider, label: c.label, status: c.status, credentialsSaved: Boolean(c.credentialsSecret ?? c.hasCredentials),
    // Masked, non-secret hints only (e.g. "...3456", the API user). The secret and the ciphertext are never returned.
    credentialHint: c.credentialHint ?? null, capabilities: adapter?.capabilities ?? null, importedAssets: imported, lastTestedAt: isoTime(c.lastTestedAt), lastSyncAt: isoTime(c.lastSyncAt),
    lastSuccessfulSyncAt: isoTime(c.lastSuccessfulSyncAt), lastErrorCode: c.lastErrorCode ?? null, lastError: c.lastError ?? null, disconnectedAt: isoTime(c.disconnectedAt), createdAt: isoTime(c.createdAt),
  };
}

/** Lean connection rows never include the secret (select:false); this adds only the boolean "has credentials". */
async function withFlag(rows: any[]) {
  if (!rows.length) return rows;
  const flags = await InfraProviderConnection.find({ _id: { $in: rows.map((r) => r._id) }, credentialsSecret: { $type: "string" } }).select("_id").lean<any[]>();
  const have = new Set(flags.map((f) => sid(f._id)));
  return rows.map((r) => ({ ...r, hasCredentials: have.has(sid(r._id)) }));
}

function adapterFor(provider: string): ProviderAdapter {
  const adapter = providerRegistry.get(provider);
  if (!adapter?.live) throw E.badRequest("This provider has no live integration. Add its servers manually.", "infra_provider_manual_only");
  return adapter;
}

async function load(id: string, withSecret = false) {
  const q = InfraProviderConnection.findById(oid(id, "connection id"));
  if (withSecret) q.select("+credentialsSecret");
  const row = await q.lean<any>();
  if (!row) throw E.notFound("Connection not found.", "infra_connection_not_found");
  return row;
}

function credentialsOf(row: any, adapter: ProviderAdapter): Record<string, string> {
  if (!row.credentialsSecret) throw E.badRequest("No credentials are saved for this connection yet.", "infra_credentials_missing");
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(decryptSecret(row.credentialsSecret));
  } catch (e) {
    if ((e as { code?: string }).code?.startsWith("infra_")) throw e;
    throw E.badRequest("Saved credentials could not be read. Replace them.", "infra_credentials_invalid");
  }
  const parsed = adapter.parseCredentials(raw);
  if (!parsed.ok) throw E.badRequest("Saved credentials are incomplete. Replace them.", "infra_credentials_invalid");
  return parsed.value;
}

function asHttp(e: unknown): unknown {
  if (e instanceof ProviderError) {
    const code = `infra_provider_${e.code.toLowerCase()}`;
    return e.code === "AUTH_FAILED" ? E.unprocessable(e.message, code) : E.badGateway(e.message, code);
  }
  return e;
}

export const catalogue = () => providerRegistry.catalogue();

const importedCount = (id: unknown) => InfraAsset.countDocuments({ providerConnectionId: id, archivedAt: null });

export async function listConnections() {
  const rows = await withFlag(await InfraProviderConnection.find({}).sort({ createdAt: 1 }).lean<any[]>());
  const counts = await InfraAsset.aggregate([{ $match: { providerConnectionId: { $in: rows.map((r) => r._id) }, archivedAt: null } }, { $group: { _id: "$providerConnectionId", n: { $sum: 1 } } }]);
  const map = new Map(counts.map((c: any) => [sid(c._id), c.n as number]));
  return { connections: rows.map((r) => view(r, map.get(sid(r._id)) ?? 0)), providers: providerRegistry.catalogue() };
}

export async function createConnection(actor: InfraActor, dto: { provider: string; label: string; credentials?: Record<string, string> }) {
  const adapter = adapterFor(dto.provider);
  let cipher: string | null = null;
  let hint: Record<string, string> | null = null;
  if (dto.credentials) {
    const parsed = adapter.parseCredentials(dto.credentials);
    if (!parsed.ok) throw E.badRequest(parsed.message, "infra_credentials_invalid");
    cipher = encryptSecret(JSON.stringify(parsed.value));
    hint = adapter.hint(parsed.value);
  }
  const row = await InfraProviderConnection.create({ provider: dto.provider, label: dto.label.trim(), status: cipher ? "ERROR" : "PENDING_CREDENTIALS", credentialsSecret: cipher, credentialHint: hint, createdByUserId: actor.userId });
  await audit(actor, { action: INFRA_ACTIONS.CONNECTION_CREATED, resourceType: INFRA_RESOURCE.CONNECTION, resourceId: row._id, metadata: { provider: dto.provider, credentialsSupplied: Boolean(cipher) } });
  return cipher ? testConnection(actor, sid(row._id)) : view({ ...row.toObject(), credentialsSecret: undefined, hasCredentials: false }, 0);
}

export async function replaceCredentials(actor: InfraActor, id: string, credentials: Record<string, string>) {
  const row = await load(id);
  const adapter = adapterFor(row.provider);
  const parsed = adapter.parseCredentials(credentials);
  if (!parsed.ok) throw E.badRequest(parsed.message, "infra_credentials_invalid");
  await InfraProviderConnection.updateOne({ _id: row._id }, { $set: { credentialsSecret: encryptSecret(JSON.stringify(parsed.value)), credentialHint: adapter.hint(parsed.value), status: "ERROR", disconnectedAt: null, lastError: null, lastErrorCode: null } });
  await audit(actor, { action: INFRA_ACTIONS.CONNECTION_CREDENTIALS_REPLACED, resourceType: INFRA_RESOURCE.CONNECTION, resourceId: id, metadata: { provider: row.provider } });
  return testConnection(actor, id);
}

/** Tests the saved credentials against the provider. The result updates the connection status; secrets are never echoed. */
export async function testConnection(_actor: InfraActor, id: string) {
  const row = await load(id, true);
  const adapter = adapterFor(row.provider);
  const creds = credentialsOf(row, adapter);
  const now = new Date();
  let update: Record<string, unknown>;
  try {
    await adapter.testConnection(creds);
    update = { status: "CONNECTED", lastTestedAt: now, lastError: null, lastErrorCode: null };
  } catch (e) {
    const pe = e instanceof ProviderError ? e : new ProviderError("The provider could not be reached.", "NETWORK");
    update = { status: pe.code === "AUTH_FAILED" ? "AUTH_FAILED" : "ERROR", lastTestedAt: now, lastError: pe.message.slice(0, 500), lastErrorCode: pe.code };
  }
  await InfraProviderConnection.updateOne({ _id: row._id }, { $set: update });
  const fresh = (await withFlag([await load(id)]))[0];
  return view(fresh, await importedCount(row._id));
}

export async function disconnect(actor: InfraActor, id: string) {
  const row = await load(id);
  // Credentials are destroyed; imported assets stay as inventory but are no longer synchronised.
  await InfraProviderConnection.updateOne({ _id: row._id }, { $set: { credentialsSecret: null, credentialHint: null, status: "DISCONNECTED", disconnectedAt: new Date(), lastError: null, lastErrorCode: null } });
  await InfraAsset.updateMany({ providerConnectionId: row._id }, { $set: { "server.syncState": "DISCONNECTED" } });
  await audit(actor, { action: INFRA_ACTIONS.CONNECTION_DISCONNECTED, resourceType: INFRA_RESOURCE.CONNECTION, resourceId: id, metadata: { provider: row.provider } });
  return { id, disconnected: true };
}

/** Instances visible to the provider account, flagged with whether they are already imported. Nothing is persisted. */
export async function remoteInstances(id: string) {
  const row = await load(id, true);
  const adapter = adapterFor(row.provider);
  try {
    const { servers, errors } = await adapter.listServers(credentialsOf(row, adapter));
    const existing = await InfraAsset.find({ providerConnectionId: row._id }).select("remoteId").lean<any[]>();
    const have = new Map(existing.map((e) => [e.remoteId as string, sid(e._id)]));
    return { partial: errors.length > 0, errors, instances: servers.map((s) => ({ ...s, providerCreatedAt: isoTime(s.providerCreatedAt), imported: have.has(s.remoteId), assetId: have.get(s.remoteId) ?? null })) };
  } catch (e) {
    throw asHttp(e);
  }
}

export async function importServers(actor: InfraActor, id: string, dto: { remoteIds?: string[]; all?: boolean; environment?: string }) {
  const row = await load(id, true);
  const adapter = adapterFor(row.provider);
  if (!dto.all && !dto.remoteIds?.length) throw E.badRequest("Choose instances to import, or import all.", "infra_nothing_selected");
  let listing;
  try {
    listing = await adapter.listServers(credentialsOf(row, adapter));
  } catch (e) {
    throw asHttp(e);
  }
  const wanted = dto.all ? listing.servers : listing.servers.filter((s) => dto.remoteIds!.includes(s.remoteId));
  const existing = new Set((await InfraAsset.find({ providerConnectionId: row._id }).select("remoteId").lean<any[]>()).map((e) => e.remoteId));
  let created = 0;
  let skipped = 0;
  for (const s of wanted) {
    if (existing.has(s.remoteId)) { skipped += 1; continue; }
    try {
      await InfraAsset.create({
        type: "SERVER", name: s.name, technicalId: s.hostname ?? s.ipv4 ?? undefined, environment: dto.environment ?? "PRODUCTION", provider: row.provider,
        providerConnectionId: row._id, remoteId: s.remoteId, tags: [], createdByUserId: actor.userId, server: { ...SERVER_FIELDS(s), lastSyncedAt: new Date(), syncState: "SYNCED" },
      });
      created += 1;
    } catch (e) {
      // The (connection, remoteId) unique key makes a concurrent double import harmless.
      if ((e as { code?: number }).code === 11000) skipped += 1;
      else throw e;
    }
  }
  await audit(actor, { action: INFRA_ACTIONS.ASSETS_IMPORTED, resourceType: INFRA_RESOURCE.CONNECTION, resourceId: id, metadata: { provider: row.provider, created, skipped } });
  return { created, skipped, notFound: dto.all ? 0 : (dto.remoteIds ?? []).filter((r) => !listing.servers.some((s) => s.remoteId === r)).length, partial: listing.errors.length > 0 };
}

/**
 * Refreshes already-imported instances. Idempotent. A provider outage records a FAILED run and leaves every asset
 * exactly as it was: nothing is marked terminated or expired because a call failed.
 */
export async function syncConnection(id: string, trigger: "manual" | "scheduled", actor?: InfraActor) {
  const row = await load(id, true);
  const adapter = adapterFor(row.provider);
  if (!row.credentialsSecret || row.status === "DISCONNECTED") throw E.badRequest("This connection has no credentials.", "infra_credentials_missing");
  const run = await InfraSyncRun.create({ connectionId: row._id, kind: "PROVIDER_SYNC", trigger, status: "RUNNING" });
  const now = new Date();
  try {
    const { servers, errors } = await adapter.listServers(credentialsOf(row, adapter));
    const imported = await InfraAsset.find({ providerConnectionId: row._id }).select("remoteId").lean<any[]>();
    const byRemote = new Map(imported.map((a) => [a.remoteId as string, a._id]));
    let updated = 0;
    for (const s of servers) {
      const assetId = byRemote.get(s.remoteId);
      if (!assetId) continue;
      const set: Record<string, unknown> = { "server.lastSyncedAt": now, "server.syncState": "SYNCED" };
      for (const [k, v] of Object.entries(SERVER_FIELDS(s))) set[`server.${k}`] = v;
      await InfraAsset.updateOne({ _id: assetId }, { $set: set });
      updated += 1;
    }
    // Instances the account has but we have not seen yet are added to the inventory, so a freshly connected account
    // shows its servers immediately.
    let created = 0;
    for (const s of servers) {
      if (byRemote.has(s.remoteId)) continue;
      try {
        await InfraAsset.create({
          type: "SERVER", name: s.name, technicalId: s.hostname ?? s.ipv4 ?? undefined, environment: "PRODUCTION", provider: row.provider, providerConnectionId: row._id, remoteId: s.remoteId, tags: [],
          createdByUserId: row.createdByUserId, server: { ...SERVER_FIELDS(s), lastSyncedAt: now, syncState: "SYNCED" },
        });
        created += 1;
      } catch (e) {
        if ((e as { code?: number }).code !== 11000) throw e;
      }
    }
    const seen = new Set(servers.map((s) => s.remoteId));
    // Only a COMPLETE listing may say an instance is no longer listed; and it is a label, not a status change.
    let notListed = 0;
    if (errors.length === 0) {
      const missing = imported.filter((a) => a.remoteId && !seen.has(a.remoteId)).map((a) => a._id);
      if (missing.length) {
        await InfraAsset.updateMany({ _id: { $in: missing } }, { $set: { "server.syncState": "NOT_LISTED" } });
        notListed = missing.length;
      }
    }
    const status = errors.length ? "PARTIAL" : "SUCCEEDED";
    await InfraSyncRun.updateOne({ _id: run._id }, { $set: { status, finishedAt: new Date(), stats: { seen: servers.length, updated, created, notListed, errors: errors.length }, error: errors[0]?.slice(0, 500) ?? null } });
    await InfraProviderConnection.updateOne({ _id: row._id }, { $set: { status: "CONNECTED", lastSyncAt: now, lastSuccessfulSyncAt: now, lastError: errors[0]?.slice(0, 500) ?? null, lastErrorCode: errors.length ? "PARTIAL" : null } });
    if (actor) await audit(actor, { action: INFRA_ACTIONS.CONNECTION_SYNCED, resourceType: INFRA_RESOURCE.CONNECTION, resourceId: id, metadata: { status, updated } });
    return { status, seen: servers.length, updated, created, notListed, errors };
  } catch (e) {
    if ((e as { code?: string }).code?.startsWith?.("infra_")) {
      await InfraSyncRun.updateOne({ _id: run._id }, { $set: { status: "FAILED", finishedAt: new Date(), errorCode: "CONFIG", error: (e as Error).message.slice(0, 500) } });
      throw e;
    }
    const pe = e instanceof ProviderError ? e : new ProviderError("The provider could not be reached.", "NETWORK");
    await InfraSyncRun.updateOne({ _id: run._id }, { $set: { status: "FAILED", finishedAt: new Date(), errorCode: pe.code, error: pe.message.slice(0, 500) } });
    await InfraProviderConnection.updateOne({ _id: row._id }, { $set: { status: pe.code === "AUTH_FAILED" ? "AUTH_FAILED" : "ERROR", lastSyncAt: now, lastError: pe.message.slice(0, 500), lastErrorCode: pe.code } });
    logger.warn(`infra.provider_sync_failed connection=${id} code=${pe.code}`);
    if (trigger === "manual") throw asHttp(pe);
    return { status: "FAILED" as const, seen: 0, updated: 0, created: 0, notListed: 0, errors: [pe.message] };
  }
}

const extrasCache = new Map<string, { at: number; value: unknown }>();

/** Live, read-only provider detail (snapshots, provider audit trail) for one imported server. Cached for 60 s. */
export async function serverExtras(assetId: string) {
  const asset = await InfraAsset.findOne({ _id: oid(assetId, "asset id"), type: "SERVER" }).select("providerConnectionId remoteId provider").lean<any>();
  if (!asset) throw E.notFound("Server not found.", "infra_asset_not_found");
  const none = (reason: string, message: string) => ({ available: false, reason, message, snapshots: [], audits: [], errors: [] as string[] });
  if (!asset.providerConnectionId || !asset.remoteId) return none("manual", "This server is managed manually, so there is no provider account to read from.");
  const conn = await InfraProviderConnection.findById(asset.providerConnectionId).select("+credentialsSecret").lean<any>();
  const adapter = conn ? providerRegistry.get(conn.provider) : null;
  if (!conn || !adapter?.getServerExtras) return none("unsupported", "This provider does not expose snapshots or an audit trail through its API.");
  if (!conn.credentialsSecret || conn.status === "DISCONNECTED") return none("disconnected", "The provider account is disconnected. Reconnect it to read snapshots and audit history.");
  const hit = extrasCache.get(assetId);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  try {
    const extras = await adapter.getServerExtras(credentialsOf(conn, adapter), asset.remoteId);
    const value = { available: true, reason: null, message: null, ...extras };
    extrasCache.set(assetId, { at: Date.now(), value });
    return value;
  } catch (e) {
    const pe = e instanceof ProviderError ? e : new ProviderError("The provider could not be reached.", "NETWORK");
    return { available: false, reason: pe.code.toLowerCase(), message: pe.message, snapshots: [], audits: [], errors: [pe.message] };
  }
}

export async function syncHistory(id: string) {
  const row = await load(id);
  const rows = await InfraSyncRun.find({ connectionId: row._id }).sort({ startedAt: -1 }).limit(30).lean<any[]>();
  return rows.map((r) => ({ id: sid(r._id), status: r.status, trigger: r.trigger, startedAt: isoTime(r.startedAt), finishedAt: isoTime(r.finishedAt), stats: r.stats ?? null, errorCode: r.errorCode ?? null, error: r.error ?? null }));
}
