import { z } from "zod";
import { E } from "./infra.util";

/** Request validation for the Infrastructure API (same rules as the original class-validator DTOs). */

export const ENVIRONMENTS = ["PRODUCTION", "STAGING", "DEVELOPMENT", "OTHER"] as const;
export const SERVER_TYPES = ["VPS", "DEDICATED", "CLOUD_INSTANCE", "SHARED_HOSTING", "MANAGED_HOSTING", "OTHER"] as const;
export const CYCLES = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY", "CUSTOM"] as const;
export const TRI = ["ENABLED", "DISABLED", "UNKNOWN"] as const;
export const PAY_STATUS = ["UNKNOWN", "PAID", "UNPAID", "PENDING"] as const;
export const SUB_KINDS = ["DOMAIN_REGISTRATION", "SERVER", "HOSTING", "SSL", "ADDON", "OTHER"] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");
const nullableStr = (max: number) => z.string().max(max).nullable().optional();

const assetCommon = {
  name: z.string().min(1).max(200).optional(),
  environment: z.enum(ENVIRONMENTS).optional(),
  provider: nullableStr(40),
  ownerName: nullableStr(160),
  ownerEmail: z.union([z.string().email().max(254), z.literal(""), z.null()]).optional().transform((v) => (v === "" ? null : v)),
  tags: z.array(z.string().max(40)).max(20).optional(),
  notes: nullableStr(4000),
  // Accepted for compatibility with clients that send a client scope; this deployment has no client scoping.
  clientId: z.any().optional(),
};

const serverFields = {
  serverType: z.enum(SERVER_TYPES).optional(),
  planName: nullableStr(160),
  hostname: nullableStr(255),
  ipv4: nullableStr(15),
  ipv6: nullableStr(45),
  region: nullableStr(80),
  datacenter: nullableStr(120),
  operatingSystem: nullableStr(160),
  vcpu: z.number().int().min(1).max(4096).nullable().optional(),
  ramMb: z.number().int().min(1).max(100_000_000).nullable().optional(),
  storageGb: z.number().int().min(1).max(1_000_000_000).nullable().optional(),
  storageType: nullableStr(40),
  remoteId: nullableStr(120),
};

export const createServerSchema = z.object({ ...assetCommon, ...serverFields, name: z.string().min(1).max(200) }).strip();
export const updateAssetSchema = z.object({ ...assetCommon, ...serverFields, alertsEnabled: z.boolean().optional() }).strip();
export const createDomainSchema = z.object({ ...assetCommon, domain: z.string().min(3).max(260), alertsEnabled: z.boolean().optional() }).strip();
export const bulkDomainsSchema = z.object({ domains: z.array(z.string().max(260)).max(200), environment: z.enum(ENVIRONMENTS).optional(), clientId: z.any().optional() }).strip();
export const bulkRefreshSchema = z.object({ assetIds: z.array(objectId).max(100) }).strip();
export const linkSchema = z.object({ toAssetId: objectId, kind: z.enum(["HOSTS", "POINTS_TO", "SECURED_BY", "USES"]) }).strip();
export const certificateSchema = z.object({ assetId: objectId, hostname: z.string().max(255), port: z.union([z.literal(443), z.literal(8443)]).optional() }).strip();

const amount = z.number().min(0).max(99_999_999).refine((n) => Math.round(n * 100) / 100 === n, "At most 2 decimal places");
export const subscriptionSchema = z
  .object({
    assetId: objectId.optional(),
    kind: z.enum(SUB_KINDS).optional(),
    label: nullableStr(160),
    providerName: nullableStr(120),
    billingAccount: nullableStr(160),
    cycle: z.enum(CYCLES).optional(),
    customIntervalMonths: z.number().int().min(1).max(120).nullable().optional(),
    currency: z.string().regex(/^[A-Z]{3}$/).optional(),
    amount: amount.nullable().optional(),
    autoRenew: z.enum(TRI).optional(),
    paymentStatus: z.enum(PAY_STATUS).optional(),
    lastPaymentDate: z.string().regex(DATE).nullable().optional(),
    nextDueDate: z.string().regex(DATE).nullable().optional(),
    renewalDate: z.string().regex(DATE).nullable().optional(),
    expirationDate: z.string().regex(DATE).nullable().optional(),
    graceDays: z.number().int().min(0).max(365).nullable().optional(),
    invoiceRef: nullableStr(120),
    notes: nullableStr(2000),
    dateSource: z.literal("manual").optional(),
    datesConfirmed: z.boolean().optional(),
  })
  .strip();

export const confirmPaymentSchema = z
  .object({
    coversDueDate: z.string().regex(DATE),
    paidAt: z.string().regex(DATE),
    amount,
    currency: z.string().regex(/^[A-Z]{3}$/).optional(),
    invoiceRef: z.string().max(120).optional(),
    note: z.string().max(500).optional(),
    advance: z.boolean().optional(),
  })
  .strip();

export const adjustmentSchema = z
  .object({ amount: z.number().refine((n) => Math.round(n * 100) / 100 === n, "At most 2 decimal places"), currency: z.string().regex(/^[A-Z]{3}$/).optional(), date: z.string().regex(DATE), note: z.string().min(3).max(500) })
  .strip();

export const createConnectionSchema = z.object({ provider: z.string().max(40), label: z.string().min(1).max(120), credentials: z.record(z.string(), z.string()).optional() }).strip();
export const replaceCredentialsSchema = z.object({ credentials: z.record(z.string(), z.string()) }).strip();
export const importServersSchema = z
  .object({ remoteIds: z.array(z.string().max(120)).max(500).optional(), all: z.boolean().optional(), environment: z.enum(ENVIRONMENTS).optional(), clientId: z.any().optional() })
  .strip();
export const alertActionSchema = z.object({ action: z.enum(["acknowledge", "snooze", "resolve", "reopen"]), snoozeDays: z.number().int().min(1).max(90).optional() }).strip();
export const settingsSchema = z
  .object({
    thresholdDays: z.array(z.number().int().min(0).max(365)).max(12).optional(),
    inAppEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    extraRecipients: z.array(z.string().email()).max(10).optional(),
  })
  .strip();
export const createReportSchema = z
  .object({ period: z.string().optional(), from: z.string().optional(), to: z.string().optional(), clientId: z.any().optional(), includeAi: z.boolean().optional() })
  .strip();

/** Validates and returns the parsed value, or throws a 400 with the first problems. */
export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data ?? {});
  if (r.success) return r.data;
  const issues = r.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "body"}: ${i.message}`);
  throw E.badRequest(`Validation failed: ${issues.join("; ")}`, "infra_validation_failed", { issues });
}
