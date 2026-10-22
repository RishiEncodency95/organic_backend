import mongoose, { Schema, Types } from "mongoose";

/*
 * Infrastructure module (Servers & Domains) persistence.
 *
 * Relational rules of the original design are enforced here with unique / partial-unique indexes and inside the
 * services (no foreign keys in MongoDB). Key points:
 *  - A domain's / server's facts are embedded in InfraAsset (1-to-1 in the original schema).
 *  - Money is Decimal128 at rest; services convert to numbers rounded to 2 places.
 *  - Secret-bearing fields end in "Secret" / "Hash" so the global Activity-Log plugin (config/activityTracker.ts)
 *    masks them if a write ever happens inside an admin request.
 *  - Collections are prefixed `infra_` and never touch existing collections.
 */

const opts = { timestamps: true } as const;
const J = Schema.Types.Mixed;
const ObjectId = Schema.Types.ObjectId;

export const ASSET_TYPES = ["SERVER", "DOMAIN", "HOSTING", "SSL_CERTIFICATE", "OTHER"] as const;
export const ENVIRONMENT_VALUES = ["PRODUCTION", "STAGING", "DEVELOPMENT", "OTHER"] as const;
export const SERVER_TYPE_VALUES = ["VPS", "DEDICATED", "CLOUD_INSTANCE", "SHARED_HOSTING", "MANAGED_HOSTING", "OTHER"] as const;
export const BILLING_CYCLE_VALUES = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY", "CUSTOM"] as const;
export const PAYMENT_STATUS_VALUES = ["UNKNOWN", "PAID", "UNPAID", "PENDING"] as const;
export const TRI_STATE_VALUES = ["ENABLED", "DISABLED", "UNKNOWN"] as const;
export const SUBSCRIPTION_KIND_VALUES = ["DOMAIN_REGISTRATION", "SERVER", "HOSTING", "SSL", "ADDON", "OTHER"] as const;
export const CONNECTION_STATUS_VALUES = ["PENDING_CREDENTIALS", "CONNECTED", "AUTH_FAILED", "ERROR", "DISCONNECTED"] as const;
export const ALERT_KIND_VALUES = ["RENEWAL_DUE", "DOMAIN_EXPIRY", "SSL_EXPIRY", "SYNC_FAILURE", "DNS_CHANGE", "RESOURCE_PRESSURE", "COLLECTOR_OFFLINE"] as const;
export const ALERT_STATE_VALUES = ["OPEN", "ACKNOWLEDGED", "SNOOZED", "RESOLVED"] as const;
export const SYNC_STATUS_VALUES = ["RUNNING", "SUCCEEDED", "PARTIAL", "FAILED"] as const;
export const BILLING_RECORD_KIND_VALUES = ["PAYMENT", "INVOICE", "ADJUSTMENT"] as const;

/* ---------------------------------------------------------------- settings */
// A single document (key "default"): this deployment has one organisation.
const settingsSchema = new Schema(
  {
    key: { type: String, default: "default", unique: true },
    thresholdDays: { type: [Number], default: [30, 15, 7, 3, 1, 0] },
    inAppEnabled: { type: Boolean, default: true },
    emailEnabled: { type: Boolean, default: true },
    extraRecipients: { type: [String], default: [] },
    /** Partial override of guest-metric alert thresholds (validated by the service; absent keys use defaults). */
    metricThresholds: { type: J, default: null },
    defaultCurrency: { type: String, default: "INR", match: /^[A-Z]{3}$/ },
  },
  { ...opts, collection: "infra_settings" }
);

/* ------------------------------------------------------ provider connection */
const connectionSchema = new Schema(
  {
    provider: { type: String, required: true, maxlength: 40 },
    label: { type: String, required: true, maxlength: 120 },
    status: { type: String, enum: CONNECTION_STATUS_VALUES, default: "PENDING_CREDENTIALS" },
    /** AES-256-GCM envelope. Null until credentials are supplied. Never selected by default, never returned by any API. */
    credentialsSecret: { type: String, default: null, select: false },
    /** Non-secret hints for the UI (masked client id, api user). */
    credentialHint: { type: J, default: null },
    lastTestedAt: Date,
    lastSyncAt: Date,
    lastSuccessfulSyncAt: Date,
    lastErrorCode: { type: String, maxlength: 60 },
    lastError: { type: String, maxlength: 500 },
    disconnectedAt: Date,
    createdByUserId: String,
  },
  { ...opts, collection: "infra_provider_connections" }
);
connectionSchema.index({ provider: 1 });

/* -------------------------------------------------------------------- asset */
const serverSub = new Schema(
  {
    serverType: { type: String, enum: SERVER_TYPE_VALUES, default: "VPS" },
    planName: { type: String, maxlength: 160 },
    hostname: { type: String, maxlength: 255 },
    ipv4: { type: String, maxlength: 15 },
    ipv6: { type: String, maxlength: 45 },
    additionalIps: { type: J, default: null },
    region: { type: String, maxlength: 80 },
    datacenter: { type: String, maxlength: 120 },
    operatingSystem: { type: String, maxlength: 160 },
    /** Provisioned capacity, NOT live utilisation. */
    vcpu: Number,
    ramMb: Number,
    storageGb: Number,
    storageType: { type: String, maxlength: 40 },
    networkInfo: { type: J, default: null },
    providerStatus: { type: String, maxlength: 60 },
    providerSuspended: Boolean,
    providerCreatedAt: Date,
    lastSyncedAt: Date,
    syncState: { type: String, maxlength: 20 },
  },
  { _id: false }
);

const domainSub = new Schema(
  {
    fqdn: { type: String, required: true, maxlength: 255 },
    unicodeName: { type: String, maxlength: 255 },
    tld: { type: String, required: true, maxlength: 63 },
    registrar: { type: String, maxlength: 200 },
    registeredAt: Date,
    registryExpiresAt: Date,
    registrarExpiresAt: Date,
    rdapUpdatedAt: Date,
    statuses: { type: [String], default: [] },
    nameservers: { type: [String], default: [] },
    dnssec: Boolean,
    rdapSource: { type: String, maxlength: 300 },
    rdapState: { type: String, default: "NEVER", maxlength: 20 },
    rdapError: { type: String, maxlength: 300 },
    rdapCheckedAt: Date,
    dnsState: { type: String, default: "NEVER", maxlength: 20 },
    dnsError: { type: String, maxlength: 300 },
    dnsCheckedAt: Date,
    alertsEnabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const assetSchema = new Schema(
  {
    type: { type: String, enum: ASSET_TYPES, required: true },
    name: { type: String, required: true, maxlength: 200 },
    /** Hostname, FQDN or IP: the technical identifier. */
    technicalId: { type: String, maxlength: 255 },
    environment: { type: String, enum: ENVIRONMENT_VALUES, default: "PRODUCTION" },
    provider: { type: String, maxlength: 40 },
    providerConnectionId: { type: ObjectId, ref: "InfraProviderConnection" },
    remoteId: { type: String, maxlength: 120 },
    ownerName: { type: String, maxlength: 160 },
    ownerEmail: { type: String, maxlength: 254 },
    tags: { type: [String], default: [] },
    notes: String,
    archivedAt: Date,
    createdByUserId: String,
    server: { type: serverSub, default: null },
    domain: { type: domainSub, default: null },
  },
  { ...opts, collection: "infra_assets" }
);
// A provider resource can be imported once per connection.
assetSchema.index({ providerConnectionId: 1, remoteId: 1 }, { unique: true, partialFilterExpression: { remoteId: { $type: "string" }, providerConnectionId: { $type: "objectId" } } });
// One inventory entry per domain name.
assetSchema.index({ "domain.fqdn": 1 }, { unique: true, partialFilterExpression: { "domain.fqdn": { $type: "string" } } });
assetSchema.index({ type: 1, archivedAt: 1 });

/* ------------------------------------------------------------- dns snapshot */
const dnsSnapshotSchema = new Schema(
  {
    domainId: { type: ObjectId, required: true },
    checkedAt: { type: Date, default: Date.now },
    records: { type: J, required: true },
    recordHash: { type: String, maxlength: 64 },
    changed: { type: Boolean, default: false },
    changes: { type: J, default: null },
    lookupErrors: { type: J, default: null },
  },
  { collection: "infra_dns_snapshots" }
);
dnsSnapshotSchema.index({ domainId: 1, checkedAt: -1 });

/* ---------------------------------------------------------------------- ssl */
const sslSchema = new Schema(
  {
    assetId: { type: ObjectId, default: null },
    hostname: { type: String, required: true, maxlength: 255 },
    port: { type: Number, default: 443 },
    commonName: { type: String, maxlength: 255 },
    sans: { type: [String], default: [] },
    issuer: { type: String, maxlength: 300 },
    validFrom: Date,
    validTo: Date,
    fingerprint: { type: String, maxlength: 100 },
    trusted: Boolean,
    verifyError: { type: String, maxlength: 200 },
    autoRenew: { type: String, enum: TRI_STATE_VALUES, default: "UNKNOWN" },
    lastCheckedAt: Date,
    lastSuccessAt: Date,
    lastError: { type: String, maxlength: 300 },
  },
  { ...opts, collection: "infra_ssl_certificates" }
);
sslSchema.index({ hostname: 1, port: 1 }, { unique: true });
sslSchema.index({ assetId: 1 });
sslSchema.index({ validTo: 1 });

/* ---------------------------------------------------------------- relations */
const relationSchema = new Schema(
  {
    fromAssetId: { type: ObjectId, required: true },
    toAssetId: { type: ObjectId, required: true },
    /** HOSTS | POINTS_TO | SECURED_BY | USES */
    kind: { type: String, required: true, maxlength: 20 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "infra_asset_relations" }
);
relationSchema.index({ fromAssetId: 1, toAssetId: 1, kind: 1 }, { unique: true });
relationSchema.index({ toAssetId: 1 });

/* ------------------------------------------------------------ subscriptions */
const subscriptionSchema = new Schema(
  {
    assetId: { type: ObjectId, required: true },
    kind: { type: String, enum: SUBSCRIPTION_KIND_VALUES, required: true },
    label: { type: String, maxlength: 160 },
    providerName: { type: String, maxlength: 120 },
    billingAccount: { type: String, maxlength: 160 },
    cycle: { type: String, enum: BILLING_CYCLE_VALUES, default: "MONTHLY" },
    customIntervalMonths: Number,
    currency: { type: String, required: true, match: /^[A-Z]{3}$/ },
    amount: { type: Schema.Types.Decimal128, default: null },
    autoRenew: { type: String, enum: TRI_STATE_VALUES, default: "UNKNOWN" },
    paymentStatus: { type: String, enum: PAYMENT_STATUS_VALUES, default: "UNKNOWN" },
    lastPaymentDate: Date,
    nextDueDate: Date,
    renewalDate: Date,
    expirationDate: Date,
    graceDays: Number,
    invoiceRef: { type: String, maxlength: 120 },
    notes: String,
    /** { nextDueDate: {source, verifiedAt, verifiedByUserId}, anchorDay, ... }. Absent key = unverified. */
    fieldSources: { type: J, default: null },
    archivedAt: Date,
    createdByUserId: String,
  },
  { ...opts, collection: "infra_subscriptions" }
);
subscriptionSchema.index({ assetId: 1 });
subscriptionSchema.index({ nextDueDate: 1 });
subscriptionSchema.index({ expirationDate: 1 });

const billingRecordSchema = new Schema(
  {
    subscriptionId: { type: ObjectId, required: true },
    assetId: { type: ObjectId, required: true },
    kind: { type: String, enum: BILLING_RECORD_KIND_VALUES, required: true },
    /** The due date this payment settles. Unique per subscription so a cycle can be confirmed only once. */
    coversDueDate: Date,
    amount: { type: Schema.Types.Decimal128, required: true },
    currency: { type: String, required: true, match: /^[A-Z]{3}$/ },
    paidAt: Date,
    invoiceRef: { type: String, maxlength: 120 },
    note: { type: String, maxlength: 500 },
    source: { type: String, default: "manual", maxlength: 20 },
    recordedByUserId: String,
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "infra_billing_records" }
);
billingRecordSchema.index({ subscriptionId: 1, coversDueDate: 1 }, { unique: true, partialFilterExpression: { coversDueDate: { $type: "date" } } });
billingRecordSchema.index({ paidAt: 1 });
billingRecordSchema.index({ subscriptionId: 1, createdAt: -1 });
billingRecordSchema.index({ assetId: 1 });

/* ------------------------------------------------------------------- alerts */
const alertSchema = new Schema(
  {
    assetId: { type: ObjectId, required: true },
    subscriptionId: { type: ObjectId, default: null },
    kind: { type: String, enum: ALERT_KIND_VALUES, required: true },
    thresholdDays: Number,
    targetDate: Date,
    dedupeKey: { type: String, required: true, unique: true, maxlength: 200 },
    state: { type: String, enum: ALERT_STATE_VALUES, default: "OPEN" },
    severity: { type: String, required: true, maxlength: 10 },
    title: { type: String, required: true, maxlength: 160 },
    message: { type: String, required: true, maxlength: 1000 },
    raisedAt: { type: Date, default: Date.now },
    acknowledgedAt: Date,
    acknowledgedBy: String,
    snoozedUntil: Date,
    resolvedAt: Date,
    resolvedBy: String,
    deliveredAt: Date,
    deliveryAttempts: { type: Number, default: 0 },
    /** Short lease taken while an alert is being delivered, so two workers can never deliver it twice. */
    deliveryLeaseUntil: Date,
    deliveryError: { type: String, maxlength: 300 },
    deliverySummary: { type: J, default: null },
  },
  { collection: "infra_alerts" }
);
alertSchema.index({ state: 1, raisedAt: -1 });
alertSchema.index({ assetId: 1 });

/* ---------------------------------------------------------------- sync runs */
const syncRunSchema = new Schema(
  {
    connectionId: { type: ObjectId, default: null },
    assetId: { type: ObjectId, default: null },
    /** PROVIDER_SYNC | RDAP | DNS | SSL | RENEWAL_EVALUATION */
    kind: { type: String, required: true, maxlength: 24 },
    status: { type: String, enum: SYNC_STATUS_VALUES, default: "RUNNING" },
    trigger: { type: String, default: "manual", maxlength: 12 },
    startedAt: { type: Date, default: Date.now },
    finishedAt: Date,
    stats: { type: J, default: null },
    errorCode: { type: String, maxlength: 60 },
    error: { type: String, maxlength: 500 },
  },
  { collection: "infra_sync_runs" }
);
syncRunSchema.index({ startedAt: -1 });
syncRunSchema.index({ connectionId: 1, startedAt: -1 });
syncRunSchema.index({ assetId: 1, startedAt: -1 });
// Retention: run history is kept 90 days.
syncRunSchema.index({ startedAt: 1 }, { expireAfterSeconds: 90 * 86400, name: "ttl_started_90d" });

/* ---------------------------------------------------------------- collector */
const collectorSchema = new Schema(
  {
    assetId: { type: ObjectId, required: true, unique: true },
    /** SHA-256 of the bearer token; the token itself is shown once and never stored. */
    tokenHash: { type: String, required: true, unique: true, maxlength: 64 },
    tokenHint: { type: String, required: true, maxlength: 8 },
    label: { type: String, maxlength: 120 },
    agentVersion: { type: String, maxlength: 40 },
    createdByUserId: String,
    rotatedAt: Date,
    revokedAt: Date,
    lastSeenAt: Date,
    lastSampleAt: Date,
    hostFacts: { type: J, default: null },
    /** Latest container/service/security snapshot (replaced each push, never a history). */
    latestReport: { type: J, default: null },
    lastCounters: { type: J, default: null },
    /** Hysteresis state: { rule: { breaches, clears, openedAt } } */
    ruleState: { type: J, default: null },
    rejectedCount: { type: Number, default: 0 },
  },
  { ...opts, collection: "infra_collectors" }
);
collectorSchema.index({ lastSampleAt: 1 });

/* ------------------------------------------------------------ metric sample */
// A regular collection (not a time-series one) so the original (assetId, ts) uniqueness can make duplicates idempotent.
// Retention is a TTL index (30 days), replacing the original pruning job.
const sampleSchema = new Schema(
  {
    assetId: { type: ObjectId, required: true },
    ts: { type: Date, required: true },
    cpuPct: Number,
    cpuUserPct: Number,
    cpuSystemPct: Number,
    cpuIowaitPct: Number,
    cpuStealPct: Number,
    load1: Number,
    load5: Number,
    load15: Number,
    memTotalBytes: Number,
    memAvailBytes: Number,
    memCachedBytes: Number,
    swapTotalBytes: Number,
    swapUsedBytes: Number,
    diskMaxUsedPct: Number,
    filesystems: { type: J, default: null },
    diskReadBps: Number,
    diskWriteBps: Number,
    netRxBps: Number,
    netTxBps: Number,
    netErrPerSec: Number,
    netDropPerSec: Number,
    uptimeSec: Number,
  },
  { collection: "infra_metric_samples", versionKey: false }
);
sampleSchema.index({ assetId: 1, ts: 1 }, { unique: true });
sampleSchema.index({ ts: 1 }, { expireAfterSeconds: 30 * 86400, name: "ttl_ts_30d" });

/* ------------------------------------------------------------------ reports */
const reportSchema = new Schema(
  {
    createdByUserId: String,
    /** daily | weekly | monthly | yearly | custom */
    period: { type: String, required: true, maxlength: 12 },
    periodFrom: { type: Date, required: true },
    periodTo: { type: Date, required: true },
    title: { type: String, required: true, maxlength: 200 },
    /** PENDING | RUNNING | READY | FAILED */
    status: { type: String, default: "PENDING", maxlength: 10 },
    aiRequested: { type: Boolean, default: true },
    /** ok | skipped | failed */
    aiStatus: { type: String, maxlength: 10 },
    aiProvider: { type: String, maxlength: 20 },
    aiModel: { type: String, maxlength: 60 },
    aiError: { type: String, maxlength: 300 },
    includesBilling: { type: Boolean, default: false },
    facts: { type: J, default: null },
    narrative: { type: J, default: null },
    error: { type: String, maxlength: 300 },
    completedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "infra_reports" }
);
reportSchema.index({ createdAt: -1 });

/* -------------------------------------------------------------- audit events */
// Append-only audit trail for infrastructure actions (the original module's `infrastructure.*` audit log entries).
const auditSchema = new Schema(
  {
    resourceType: { type: String, required: true, maxlength: 40 },
    resourceId: { type: String, maxlength: 40 },
    action: { type: String, required: true, maxlength: 60 },
    outcome: { type: String, default: "SUCCESS", maxlength: 12 },
    actorType: { type: String, default: "USER", maxlength: 10 },
    actorUserId: String,
    actorName: String,
    metadata: { type: J, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "infra_audit_events" }
);
auditSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });

/* ----------------------------------------------------- in-app notifications */
// In-app alert notifications for administrators (the original module notified Owners/Admins in-app).
const notificationSchema = new Schema(
  {
    userId: { type: String, required: true },
    type: { type: String, required: true, maxlength: 40 },
    title: { type: String, required: true, maxlength: 160 },
    message: { type: String, required: true, maxlength: 1000 },
    data: { type: J, default: null },
    readAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "infra_notifications" }
);
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 86400, name: "ttl_created_180d" });

/* ---------------------------------------------------------- scheduler locks */
// Lease locks so the scheduled sweep runs once across all application instances.
const lockSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    owner: String,
    lockedUntil: { type: Date, default: new Date(0) },
    lastStartedAt: Date,
    lastFinishedAt: Date,
    lastResult: { type: J, default: null },
  },
  { collection: "infra_locks" }
);

const make = <T>(name: string, schema: Schema) => (mongoose.models[name] as mongoose.Model<T>) || mongoose.model<T>(name, schema);

export const InfraSettings = make<any>("InfraSettings", settingsSchema);
export const InfraProviderConnection = make<any>("InfraProviderConnection", connectionSchema);
export const InfraAsset = make<any>("InfraAsset", assetSchema);
export const InfraDnsSnapshot = make<any>("InfraDnsSnapshot", dnsSnapshotSchema);
export const InfraSslCertificate = make<any>("InfraSslCertificate", sslSchema);
export const InfraAssetRelation = make<any>("InfraAssetRelation", relationSchema);
export const InfraSubscription = make<any>("InfraSubscription", subscriptionSchema);
export const InfraBillingRecord = make<any>("InfraBillingRecord", billingRecordSchema);
export const InfraAlert = make<any>("InfraAlert", alertSchema);
export const InfraSyncRun = make<any>("InfraSyncRun", syncRunSchema);
export const InfraCollector = make<any>("InfraCollector", collectorSchema);
export const InfraMetricSample = make<any>("InfraMetricSample", sampleSchema);
export const InfraReport = make<any>("InfraReport", reportSchema);
export const InfraAuditEvent = make<any>("InfraAuditEvent", auditSchema);
export const InfraNotification = make<any>("InfraNotification", notificationSchema);
export const InfraLock = make<any>("InfraLock", lockSchema);

export const INFRA_MODELS = [InfraSettings, InfraProviderConnection, InfraAsset, InfraDnsSnapshot, InfraSslCertificate, InfraAssetRelation, InfraSubscription, InfraBillingRecord, InfraAlert, InfraSyncRun, InfraCollector, InfraMetricSample, InfraReport, InfraAuditEvent, InfraNotification, InfraLock];

export type ObjectIdLike = Types.ObjectId | string;
