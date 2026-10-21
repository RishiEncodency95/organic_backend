import { Types } from "mongoose";
import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../../utils/ApiError";
import { InfraAuditEvent } from "../../models/infrastructure/infrastructure.models";

/** An ApiError that also carries the original module's stable machine code (`infra_domain_exists`, ...). */
export class InfraError extends ApiError {
  constructor(statusCode: number, message: string, public code: string, public extra: Record<string, unknown> = {}) {
    super(statusCode, message);
  }
}

export const E = {
  badRequest: (message: string, code = "infra_bad_request", extra?: Record<string, unknown>) => new InfraError(400, message, code, extra),
  unauthorized: (message: string, code = "infra_unauthorized") => new InfraError(401, message, code),
  forbidden: (message: string, code = "infra_forbidden") => new InfraError(403, message, code),
  notFound: (message: string, code = "infra_not_found") => new InfraError(404, message, code),
  conflict: (message: string, code = "infra_conflict", extra?: Record<string, unknown>) => new InfraError(409, message, code, extra),
  unprocessable: (message: string, code = "infra_unprocessable") => new InfraError(422, message, code),
  tooMany: (message: string, code = "infra_rate_limited") => new InfraError(429, message, code),
  badGateway: (message: string, code = "infra_bad_gateway") => new InfraError(502, message, code),
  unavailable: (message: string, code = "infra_unavailable") => new InfraError(503, message, code),
};

/** Formats InfraError with its `code`; anything else falls through to the app's global error handler. */
export const infraErrorHandler = (err: unknown, _req: Request, res: Response, next: NextFunction): void => {
  if (err instanceof InfraError) {
    res.status(err.statusCode).json({ success: false, statusCode: err.statusCode, message: err.message, code: err.code, ...err.extra, errors: [], timestamp: new Date().toISOString() });
    return;
  }
  next(err);
};

/* ------------------------------------------------------------------- ids */

export const isObjectId = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{24}$/i.test(v);

/** Path/body ids are validated before they reach a query. */
export function oid(v: unknown, what = "id", code = "infra_invalid_id"): Types.ObjectId {
  if (!isObjectId(v)) throw E.badRequest(`Invalid ${what}.`, code);
  return new Types.ObjectId(v);
}

export const sid = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

/* ----------------------------------------------------------------- dates */

export const isoDate = (d: Date | null | undefined): string | null => (d ? new Date(d).toISOString().slice(0, 10) : null);
export const isoTime = (d: Date | null | undefined): string | null => (d ? new Date(d).toISOString() : null);

/** Date-only (YYYY-MM-DD) -> UTC midnight Date, or null. */
export function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}

/* ----------------------------------------------------------------- money */

/** Decimal128 (or number) -> number rounded to 2 places; null stays null. */
export function money(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(typeof v === "object" ? (v as { toString(): string }).toString() : v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function dec(v: number | null | undefined): Types.Decimal128 | null {
  if (v === null || v === undefined) return null;
  return Types.Decimal128.fromString((Math.round(v * 100) / 100).toFixed(2));
}

/* ------------------------------------------------------------------ misc */

export const clip = (s: string | null | undefined, n: number): string | null => (s ? s.slice(0, n) : null);
export const errMsg = (e: unknown, fallback = "failed"): string => (e instanceof Error ? e.message : fallback);

/** Small bounded-concurrency map: external lookups never fan out unbounded. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

export const INFRA_RESOURCE = { ASSET: "infrastructure_asset", SUBSCRIPTION: "infrastructure_subscription", CONNECTION: "infrastructure_connection", ALERT: "infrastructure_alert", REPORT: "infrastructure_report" } as const;

export const INFRA_ACTIONS = {
  ASSET_CREATED: "infrastructure.asset.created", ASSET_UPDATED: "infrastructure.asset.updated", ASSET_ARCHIVED: "infrastructure.asset.archived", ASSET_RESTORED: "infrastructure.asset.restored",
  ASSET_DELETED: "infrastructure.asset.deleted", ASSET_LINKED: "infrastructure.asset.linked", ASSETS_IMPORTED: "infrastructure.assets.imported",
  SUBSCRIPTION_SAVED: "infrastructure.subscription.saved", PAYMENT_CONFIRMED: "infrastructure.payment.confirmed", BILLING_ADJUSTED: "infrastructure.billing.adjusted",
  CONNECTION_CREATED: "infrastructure.connection.created", CONNECTION_CREDENTIALS_REPLACED: "infrastructure.connection.credentials_replaced", CONNECTION_DISCONNECTED: "infrastructure.connection.disconnected",
  CONNECTION_SYNCED: "infrastructure.connection.synced", ALERT_UPDATED: "infrastructure.alert.updated", SETTINGS_UPDATED: "infrastructure.settings.updated",
  COLLECTOR_CREATED: "infrastructure.collector.created", COLLECTOR_REVOKED: "infrastructure.collector.revoked", REPORT_GENERATED: "infrastructure.report.generated", REPORT_DELETED: "infrastructure.report.deleted",
} as const;

export interface InfraActor {
  userId: string;
  name: string;
  email?: string;
  superAdmin: boolean;
  perms: Set<string>;
  can(permission: string): boolean;
  /** Owner/Admin equivalent: super admins and roles allowed to manage integrations. */
  privileged: boolean;
}

/** Writes to the infrastructure audit trail. Never throws: auditing must not break the action it describes. */
export async function audit(actor: InfraActor | null, entry: { action: string; resourceType: string; resourceId?: unknown; outcome?: "SUCCESS" | "FAILURE"; metadata?: Record<string, unknown> }): Promise<void> {
  try {
    await InfraAuditEvent.create({
      resourceType: entry.resourceType,
      resourceId: entry.resourceId === undefined ? undefined : sid(entry.resourceId),
      action: entry.action,
      outcome: entry.outcome ?? "SUCCESS",
      actorType: actor ? "USER" : "SYSTEM",
      actorUserId: actor?.userId,
      actorName: actor?.name,
      metadata: entry.metadata ?? null,
    });
  } catch {
    /* intentionally swallowed */
  }
}
