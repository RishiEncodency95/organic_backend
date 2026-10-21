import nodemailer from "nodemailer";
import { Admin } from "../../models/Admin.model";
import { Role } from "../../models/Role.model";
import { InfraAlert, InfraAsset, InfraNotification } from "../../models/infrastructure/infrastructure.models";
import { logger } from "../../utils/logger";
import { dedupeKey, DEFAULT_THRESHOLDS, evaluateThreshold, sanitizeThresholds, severityFor } from "./core/alert-rules";
import { buildRenewalItems, type RenewalItem } from "./core/renewal-items";
import { asRows, getSettingsDoc, loadActiveAssets, upsertSettings } from "./infra.data";
import { INFRA_PERM } from "./infra.access";
import { audit, E, errMsg, INFRA_ACTIONS, INFRA_RESOURCE, isoDate, isoTime, oid, sid, type InfraActor } from "./infra.util";

const MAX_DELIVERY_ATTEMPTS = 5;
const OPEN_STATES = ["OPEN", "ACKNOWLEDGED", "SNOOZED"] as const;

export type AlertKind = "RENEWAL_DUE" | "DOMAIN_EXPIRY" | "SSL_EXPIRY" | "SYNC_FAILURE" | "DNS_CHANGE" | "RESOURCE_PRESSURE" | "COLLECTOR_OFFLINE";

export interface RaiseEventInput {
  assetId: string;
  subscriptionId?: string | null;
  kind: AlertKind;
  severity: "info" | "warning" | "critical";
  dedupeKey: string;
  title: string;
  message: string;
  thresholdDays?: number | null;
  targetDate?: Date | null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

export const smtpConfigured = (): boolean => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS && !/^your_/i.test(process.env.SMTP_PASS));

async function sendMail(to: string, subject: string, text: string, html: string): Promise<void> {
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST || "smtp.gmail.com", port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  const fromName = process.env.FROM_NAME || "Bharat Organic Expo";
  const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER!;
  await transporter.sendMail({ from: `"${fromName}" <${fromEmail}>`, to, subject, text, html });
}

/** Active administrators who own infrastructure alerts: super admins and roles allowed to manage integrations. */
export async function alertAdmins(): Promise<Array<{ id: string; email: string | null }>> {
  const roles = await Role.find({ status: "ACTIVE", permissionIds: INFRA_PERM.INTEGRATIONS_MANAGE }).select("_id name").lean<any[]>();
  const roleIds = roles.map((r) => String(r._id));
  const roleNames = roles.map((r) => r.name);
  const admins = await Admin.find({ isActive: true, $or: [{ role: "superadmin" }, ...(roleIds.length ? [{ roleId: { $in: roleIds } }, { roleName: { $in: roleNames } }] : [])] }).select("email").lean<any[]>();
  return admins.map((a) => ({ id: String(a._id), email: a.email ?? null }));
}

export async function alertSettings() {
  const row = await getSettingsDoc();
  return {
    thresholdDays: row?.thresholdDays?.length ? [...row.thresholdDays].sort((a: number, b: number) => b - a) : [...DEFAULT_THRESHOLDS],
    inAppEnabled: row?.inAppEnabled ?? true,
    emailEnabled: row?.emailEnabled ?? true,
    extraRecipients: row?.extraRecipients ?? [],
    emailTransportConfigured: smtpConfigured(),
    quietHours: { supported: false },
    whatsapp: { supported: false, reason: "WhatsApp delivery is not wired to infrastructure alerts." },
  };
}

export async function updateAlertSettings(actor: InfraActor, dto: { thresholdDays?: number[]; inAppEnabled?: boolean; emailEnabled?: boolean; extraRecipients?: string[] }) {
  const thresholds = dto.thresholdDays === undefined ? undefined : sanitizeThresholds(dto.thresholdDays);
  if (dto.thresholdDays !== undefined && !thresholds) throw E.badRequest("Reminder days must be whole numbers between 0 and 365.", "infra_invalid_thresholds");
  const data: Record<string, unknown> = {
    ...(thresholds ? { thresholdDays: thresholds } : {}),
    ...(dto.inAppEnabled !== undefined ? { inAppEnabled: dto.inAppEnabled } : {}),
    ...(dto.emailEnabled !== undefined ? { emailEnabled: dto.emailEnabled } : {}),
    ...(dto.extraRecipients !== undefined ? { extraRecipients: [...new Set(dto.extraRecipients.map((e) => e.toLowerCase()))] } : {}),
  };
  if (Object.keys(data).length) await upsertSettings(data);
  await audit(actor, { action: INFRA_ACTIONS.SETTINGS_UPDATED, resourceType: INFRA_RESOURCE.ALERT, metadata: { fields: Object.keys(dto) } });
  return alertSettings();
}

/** Creates the alert once (unique dedupeKey) and delivers it. Returns null when it already existed. */
export async function raiseEvent(input: RaiseEventInput): Promise<string | null> {
  let row: any;
  try {
    row = await InfraAlert.create({
      assetId: oid(input.assetId), subscriptionId: input.subscriptionId ? oid(input.subscriptionId) : null, kind: input.kind, thresholdDays: input.thresholdDays ?? undefined,
      targetDate: input.targetDate ?? undefined, dedupeKey: input.dedupeKey.slice(0, 200), severity: input.severity, title: input.title.slice(0, 160), message: input.message.slice(0, 1000),
    });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return null; // already raised: dedupe
    throw e;
  }
  await deliver(sid(row._id)).catch((e) => logger.warn(`infra.alert_delivery_failed ${sid(row._id)}: ${errMsg(e, "unknown")}`));
  return sid(row._id);
}

function specFor(item: RenewalItem): { kind: AlertKind; subjectId: string; noun: string } {
  switch (item.kind) {
    case "payment_due": return { kind: "RENEWAL_DUE", subjectId: item.subscriptionId ?? item.assetId, noun: "Payment" };
    case "service_expiry": return { kind: "RENEWAL_DUE", subjectId: `${item.subscriptionId ?? item.assetId}:exp`, noun: "Service expiry" };
    case "domain_expiry": return { kind: "DOMAIN_EXPIRY", subjectId: item.assetId, noun: "Domain registration" };
    case "ssl_expiry": return { kind: "SSL_EXPIRY", subjectId: item.key.split(":")[0], noun: "SSL certificate" };
  }
}

/**
 * Idempotent: running it twice (or from two instances) creates each alert once. Projections are never alerted on.
 * Returns counts for the sync-run record.
 */
export async function evaluateAlerts(now = new Date()) {
  const settings = await alertSettings();
  const assets = await loadActiveAssets();
  const byAsset = new Map(assets.map((a) => [a.id, a]));
  const items = buildRenewalItems(asRows(assets), now).filter((i) => i.verified && i.source !== "projected");
  const currentPrefixes = new Set<string>();
  let raised = 0;
  for (const item of items) {
    const asset = byAsset.get(item.assetId)!;
    if (asset.domain && asset.domain.alertsEnabled === false) continue;
    if (item.kind === "payment_due" && item.paymentStatus === "PAID") continue; // this cycle is settled
    const spec = specFor(item);
    currentPrefixes.add(`${spec.kind}:${spec.subjectId}:${isoDate(item.date)}:`);
    const hit = evaluateThreshold(item.date, now, settings.thresholdDays);
    if (!hit) continue;
    const when = hit.type === "overdue" ? `overdue by ${-hit.daysRemaining} day${-hit.daysRemaining === 1 ? "" : "s"}` : hit.daysRemaining === 0 ? "due today" : `due in ${hit.daysRemaining} day${hit.daysRemaining === 1 ? "" : "s"}`;
    const id = await raiseEvent({
      assetId: item.assetId, subscriptionId: item.subscriptionId, kind: spec.kind, severity: severityFor(hit),
      dedupeKey: dedupeKey({ kind: spec.kind, subjectId: spec.subjectId, targetDate: item.date, hit }), thresholdDays: hit.type === "upcoming" ? hit.threshold : null, targetDate: item.date,
      title: `${spec.noun}: ${item.assetName} ${when}`,
      message: `${spec.noun} for "${item.assetName}" (${item.label}) is ${when} on ${isoDate(item.date)}.${item.verified ? "" : " This date is not verified."}`,
    });
    if (id) raised += 1;
  }

  // Close alerts whose target date moved (payment confirmed, certificate renewed, date corrected).
  const open = await InfraAlert.find({ state: { $in: [...OPEN_STATES] }, kind: { $in: ["RENEWAL_DUE", "DOMAIN_EXPIRY", "SSL_EXPIRY"] } }).select("dedupeKey").lean<any[]>();
  const stale = open.filter((a) => ![...currentPrefixes].some((p) => a.dedupeKey.startsWith(p))).map((a) => a._id);
  if (stale.length) await InfraAlert.updateMany({ _id: { $in: stale } }, { $set: { state: "RESOLVED", resolvedAt: now, resolvedBy: null } });
  // Expired snoozes reopen quietly (no second notification for the same threshold).
  await InfraAlert.updateMany({ state: "SNOOZED", snoozedUntil: { $lte: now } }, { $set: { state: "OPEN", snoozedUntil: null } });
  // Retry deliveries that failed earlier.
  const undelivered = await InfraAlert.find({ deliveredAt: null, deliveryAttempts: { $lt: MAX_DELIVERY_ATTEMPTS }, state: { $in: ["OPEN", "ACKNOWLEDGED"] } }).select("_id").limit(50).lean<any[]>();
  let retried = 0;
  for (const a of undelivered) await deliver(sid(a._id)).then(() => { retried += 1; }).catch(() => undefined);
  return { items: items.length, raised, resolved: stale.length, retried };
}

function emailAllowed(): boolean {
  // Never mail real recipients from automated tests or when explicitly switched off.
  return smtpConfigured() && process.env.NODE_ENV !== "test" && process.env.INFRA_EMAIL_DISABLED !== "true";
}

const NOTIFY_TYPE: Record<string, string> = {
  RENEWAL_DUE: "infrastructure.renewal_due", DOMAIN_EXPIRY: "infrastructure.domain_expiry", SSL_EXPIRY: "infrastructure.ssl_expiry", SYNC_FAILURE: "infrastructure.sync_failure",
  DNS_CHANGE: "infrastructure.dns_change", RESOURCE_PRESSURE: "infrastructure.resource_pressure", COLLECTOR_OFFLINE: "infrastructure.collector_offline",
};

export async function deliver(alertId: string): Promise<void> {
  // Single-flight: whoever wins this conditional update owns the delivery; any concurrent caller returns here.
  const now = new Date();
  const claimed = await InfraAlert.findOneAndUpdate(
    { _id: oid(alertId), deliveredAt: null, deliveryAttempts: { $lt: MAX_DELIVERY_ATTEMPTS }, $or: [{ deliveryLeaseUntil: null }, { deliveryLeaseUntil: { $lt: now } }] },
    { $set: { deliveryLeaseUntil: new Date(now.getTime() + 2 * 60_000) }, $inc: { deliveryAttempts: 1 } },
    { new: true }
  ).lean<any>();
  if (!claimed) return;
  const alert = claimed;
  const asset = await InfraAsset.findById(alert.assetId).select("name ownerEmail").lean<any>();
  const settings = await alertSettings();
  const admins = await alertAdmins();
  const summary: Record<string, unknown> = {};
  let ok = false;
  let error: string | null = null;
  if (settings.inAppEnabled && admins.length) {
    await InfraNotification.insertMany(admins.map((m) => ({ userId: m.id, type: NOTIFY_TYPE[alert.kind] ?? "infrastructure.alert", title: alert.title, message: alert.message, data: { alertId: sid(alert._id), assetId: sid(alert.assetId), kind: alert.kind } })));
    summary.inApp = admins.length;
    ok = true;
  }
  if (settings.emailEnabled) {
    const to = [...new Set([...admins.map((m) => m.email), asset?.ownerEmail, ...settings.extraRecipients].filter((e): e is string => Boolean(e)).map((e) => e.toLowerCase()))].slice(0, 15);
    if (!to.length) summary.email = { skipped: "no_recipient" };
    else if (!emailAllowed()) summary.email = { skipped: smtpConfigured() ? "disabled" : "smtp_not_configured" };
    else {
      let sent = 0;
      for (const addr of to) {
        try {
          await sendMail(addr, `[Infrastructure] ${alert.title}`, `${alert.message}\n\nOpen Infrastructure in your admin panel to acknowledge or snooze this alert.`, `<p>${esc(alert.message)}</p><p>Open <strong>Infrastructure</strong> in your admin panel to acknowledge or snooze this alert.</p>`);
          sent += 1;
        } catch (e) {
          error = errMsg(e, "email failed").slice(0, 300);
        }
      }
      summary.email = { sent, failed: to.length - sent };
      if (sent > 0) ok = true;
    }
  }
  const noChannel = !("inApp" in summary) && !(summary.email && "sent" in (summary.email as object));
  await InfraAlert.updateOne(
    { _id: alert._id },
    // A channel set that cannot deliver at all (nobody to tell / email off) is final; a failure is retried.
    { $set: { deliveryLeaseUntil: null, deliverySummary: summary, deliveryError: ok ? null : error, ...(ok || (noChannel && !error) ? { deliveredAt: new Date() } : {}) } }
  );
}

/* ------------------------------------------------------------- read / act */

export async function listAlerts(q: { state?: string; kind?: string; page?: number; limit?: number }) {
  const page = Math.max(1, q.page ?? 1);
  const limit = Math.min(100, Math.max(1, q.limit ?? 25));
  const live = await InfraAsset.find({}).select("_id").lean<any[]>(); // alerts of deleted assets are removed with the asset
  const where: Record<string, unknown> = {
    assetId: { $in: live.map((a) => a._id) },
    ...(q.state === "active" ? { state: { $in: [...OPEN_STATES] } } : q.state ? { state: q.state } : {}),
    ...(q.kind ? { kind: q.kind } : {}),
  };
  const [total, openCount, rows] = await Promise.all([
    InfraAlert.countDocuments(where),
    InfraAlert.countDocuments({ state: "OPEN", assetId: { $in: live.map((a) => a._id) } }),
    InfraAlert.find(where).sort({ raisedAt: -1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean<any[]>(),
  ]);
  const assets = await InfraAsset.find({ _id: { $in: rows.map((r) => r.assetId) } }).select("name type technicalId").lean<any[]>();
  const assetBy = new Map(assets.map((a) => [sid(a._id), { id: sid(a._id), name: a.name, type: a.type, technicalId: a.technicalId ?? null }]));
  return {
    total, openCount, page, limit,
    items: rows.map((a) => ({
      id: sid(a._id), kind: a.kind, state: a.state, severity: a.severity, title: a.title, message: a.message, thresholdDays: a.thresholdDays ?? null, targetDate: isoDate(a.targetDate),
      raisedAt: isoTime(a.raisedAt), acknowledgedAt: isoTime(a.acknowledgedAt), snoozedUntil: isoTime(a.snoozedUntil), resolvedAt: isoTime(a.resolvedAt),
      delivery: { deliveredAt: isoTime(a.deliveredAt), attempts: a.deliveryAttempts ?? 0, error: a.deliveryError ?? null, summary: a.deliverySummary ?? null },
      asset: assetBy.get(sid(a.assetId)) ?? null,
    })),
  };
}

export async function actOnAlert(actor: InfraActor, id: string, action: string, snoozeDays = 7) {
  const alert = await InfraAlert.findById(oid(id, "alert id")).select("state").lean<any>();
  if (!alert) throw E.notFound("Alert not found.", "infra_alert_not_found");
  const now = new Date();
  const data: Record<string, unknown> =
    action === "acknowledge" ? { state: "ACKNOWLEDGED", acknowledgedAt: now, acknowledgedBy: actor.userId }
    : action === "snooze" ? { state: "SNOOZED", snoozedUntil: new Date(now.getTime() + snoozeDays * 86_400_000) }
    : action === "resolve" ? { state: "RESOLVED", resolvedAt: now, resolvedBy: actor.userId }
    : { state: "OPEN", resolvedAt: null, resolvedBy: null, snoozedUntil: null };
  await InfraAlert.updateOne({ _id: alert._id }, { $set: data });
  await audit(actor, { action: INFRA_ACTIONS.ALERT_UPDATED, resourceType: INFRA_RESOURCE.ALERT, resourceId: id, metadata: { action } });
  return { id, state: (data.state as string) ?? alert.state };
}

/* ------------------------------------------------------ in-app notifications */

export async function listNotifications(userId: string) {
  const rows = await InfraNotification.find({ userId }).sort({ createdAt: -1 }).limit(50).lean<any[]>();
  return {
    unread: rows.filter((r) => !r.readAt).length,
    items: rows.map((r) => ({ id: sid(r._id), type: r.type, title: r.title, message: r.message, data: r.data ?? null, read: Boolean(r.readAt), createdAt: isoTime(r.createdAt) })),
  };
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  const filter: Record<string, unknown> = { userId, readAt: null };
  if (ids?.length) filter._id = { $in: ids.map((i) => oid(i, "notification id")) };
  const r = await InfraNotification.updateMany(filter, { $set: { readAt: new Date() } });
  return { updated: r.modifiedCount };
}
