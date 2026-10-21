import { InfraAsset, InfraBillingRecord, InfraSubscription } from "../../models/infrastructure/infrastructure.models";
import { nextCycleDate, type BillingCycle } from "./core/billing-math";
import { anchorDayOf } from "./core/renewal-items";
import { defaultCurrency } from "./infra.data";
import { audit, dec, E, INFRA_ACTIONS, INFRA_RESOURCE, isoDate, isoTime, money, oid, sid, toDate, type InfraActor } from "./infra.util";

const DATE_FIELDS = ["lastPaymentDate", "nextDueDate", "renewalDate", "expirationDate"] as const;
const KIND_FOR_ASSET: Record<string, string> = { DOMAIN: "DOMAIN_REGISTRATION", SERVER: "SERVER", HOSTING: "HOSTING", SSL_CERTIFICATE: "SSL", OTHER: "OTHER" };

type Sources = Record<string, unknown>;

async function subscriptionOf(id: string) {
  const sub = await InfraSubscription.findById(oid(id, "subscription id")).lean<any>();
  if (!sub) throw E.notFound("Subscription not found.", "infra_subscription_not_found");
  return sub;
}

/** Dates entered by an administrator are recorded as manual and verified, unless they say they are only an estimate. */
function applyDates(dto: any, current: Sources, userId: string) {
  const data: Record<string, Date | null> = {};
  const sources: Sources = { ...current };
  const now = new Date().toISOString();
  for (const field of DATE_FIELDS) {
    const raw = dto[field];
    if (raw === undefined) continue;
    if (raw === null) {
      data[field] = null;
      delete sources[field];
      continue;
    }
    const parsed = toDate(raw);
    if (!parsed) throw E.badRequest(`${field} is not a valid date.`, "infra_invalid_date");
    data[field] = parsed;
    if (dto.datesConfirmed === false) delete sources[field];
    else sources[field] = { source: "manual", verifiedAt: now, verifiedByUserId: userId };
  }
  if (data.nextDueDate) sources.anchorDay = data.nextDueDate.getUTCDate();
  return { data, sources };
}

export async function createSubscription(actor: InfraActor, dto: any) {
  if (!dto.assetId) throw E.badRequest("Choose the asset this subscription belongs to.", "infra_asset_required");
  const asset = await InfraAsset.findById(oid(dto.assetId, "asset id")).select("type provider").lean<any>();
  if (!asset) throw E.notFound("Asset not found.", "infra_asset_not_found");
  const cycle = dto.cycle ?? "MONTHLY";
  if (cycle === "CUSTOM" && !dto.customIntervalMonths) throw E.badRequest("A custom billing cycle needs an interval in months.", "infra_custom_interval_required");
  const { data, sources } = applyDates(dto, {}, actor.userId);
  const created = await InfraSubscription.create({
    assetId: asset._id, kind: dto.kind ?? KIND_FOR_ASSET[asset.type] ?? "OTHER", label: dto.label ?? undefined, providerName: dto.providerName ?? asset.provider ?? undefined,
    billingAccount: dto.billingAccount ?? undefined, cycle, customIntervalMonths: cycle === "CUSTOM" ? dto.customIntervalMonths ?? undefined : undefined,
    currency: dto.currency ?? (await defaultCurrency()), amount: dec(dto.amount ?? null), autoRenew: dto.autoRenew ?? "UNKNOWN", paymentStatus: dto.paymentStatus ?? "UNKNOWN",
    graceDays: dto.graceDays ?? undefined, invoiceRef: dto.invoiceRef ?? undefined, notes: dto.notes ?? undefined, fieldSources: sources, createdByUserId: actor.userId, ...data,
  });
  await audit(actor, { action: INFRA_ACTIONS.SUBSCRIPTION_SAVED, resourceType: INFRA_RESOURCE.SUBSCRIPTION, resourceId: created._id, metadata: { assetId: sid(asset._id), created: true } });
  return { id: sid(created._id) };
}

export async function updateSubscription(actor: InfraActor, id: string, dto: any) {
  const sub = await subscriptionOf(id);
  const cycle = dto.cycle ?? sub.cycle;
  if (cycle === "CUSTOM" && !(dto.customIntervalMonths ?? sub.customIntervalMonths)) throw E.badRequest("A custom billing cycle needs an interval in months.", "infra_custom_interval_required");
  const { data, sources } = applyDates(dto, (sub.fieldSources ?? {}) as Sources, actor.userId);
  const set: Record<string, unknown> = { fieldSources: sources, ...data };
  for (const k of ["kind", "label", "providerName", "billingAccount", "cycle", "currency", "autoRenew", "paymentStatus", "graceDays", "invoiceRef", "notes"]) if (dto[k] !== undefined && dto[k] !== "") set[k] = dto[k];
  if (dto.customIntervalMonths !== undefined || dto.cycle) set.customIntervalMonths = cycle === "CUSTOM" ? dto.customIntervalMonths ?? sub.customIntervalMonths : null;
  if (dto.amount !== undefined) set.amount = dec(dto.amount);
  await InfraSubscription.updateOne({ _id: sub._id }, { $set: set });
  await audit(actor, { action: INFRA_ACTIONS.SUBSCRIPTION_SAVED, resourceType: INFRA_RESOURCE.SUBSCRIPTION, resourceId: id, metadata: { assetId: sid(sub.assetId), fields: Object.keys(dto) } });
  return { id };
}

export async function archiveSubscription(actor: InfraActor, id: string) {
  const sub = await subscriptionOf(id);
  await InfraSubscription.updateOne({ _id: sub._id }, { $set: { archivedAt: new Date() } });
  await audit(actor, { action: INFRA_ACTIONS.SUBSCRIPTION_SAVED, resourceType: INFRA_RESOURCE.SUBSCRIPTION, resourceId: id, metadata: { archived: true } });
  return { id, archived: true };
}

/**
 * Records that a payment was actually made. This is the ONLY path that advances a confirmed due date: receiving an
 * invoice is not a payment, and nothing here runs automatically. History is retained: each cycle keeps its own row.
 *
 * Atomicity without multi-document transactions (so it works on any MongoDB topology): the payment row is inserted
 * first - its (subscription, due date) unique index makes a second confirmation impossible - and the subscription is
 * then advanced with a compare-and-set on the previous due date. If the advance fails the payment row is removed.
 */
export async function confirmPayment(actor: InfraActor, id: string, dto: { coversDueDate: string; paidAt: string; amount: number; currency?: string; invoiceRef?: string; note?: string; advance?: boolean }) {
  const sub = await subscriptionOf(id);
  const covers = toDate(dto.coversDueDate);
  const paidAt = toDate(dto.paidAt);
  if (!covers || !paidAt) throw E.badRequest("Dates must be valid calendar dates.", "infra_invalid_date");
  if (paidAt.getTime() > Date.now() + 86_400_000) throw E.badRequest("A payment date cannot be in the future.", "infra_future_payment");
  const matchesCurrentDue = Boolean(sub.nextDueDate && isoDate(sub.nextDueDate) === isoDate(covers));
  const wantsAdvance = dto.advance !== false;
  let next: Date | null = null;
  if (wantsAdvance && matchesCurrentDue) {
    next = nextCycleDate(sub.nextDueDate, sub.cycle as BillingCycle, sub.customIntervalMonths, anchorDayOf(sub.fieldSources));
    if (!next) throw E.badRequest("The billing cycle length is unknown, so the next due date cannot be calculated. Set the cycle first.", "infra_cycle_unknown");
  }
  let record: any;
  try {
    record = await InfraBillingRecord.create({
      subscriptionId: sub._id, assetId: sub.assetId, kind: "PAYMENT", coversDueDate: covers, amount: dec(dto.amount), currency: dto.currency ?? sub.currency, paidAt,
      invoiceRef: dto.invoiceRef ?? undefined, note: dto.note ?? undefined, source: "manual", recordedByUserId: actor.userId,
    });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw E.conflict("A payment has already been confirmed for that due date.", "infra_payment_exists");
    throw e;
  }
  try {
    const sources: Sources = { ...((sub.fieldSources ?? {}) as Sources) };
    if (next) sources.nextDueDate = { source: "cycle_from_confirmed_payment", verifiedAt: new Date().toISOString(), verifiedByUserId: actor.userId };
    sources.lastPaymentDate = { source: "manual", verifiedAt: new Date().toISOString(), verifiedByUserId: actor.userId };
    if (next) sources.anchorDay = anchorDayOf(sub.fieldSources) ?? sub.nextDueDate.getUTCDate();
    const filter: Record<string, unknown> = { _id: sub._id };
    if (next) filter.nextDueDate = sub.nextDueDate; // compare-and-set: only the first confirmation of this cycle advances it
    const res = await InfraSubscription.updateOne(filter, {
      $set: {
        lastPaymentDate: !sub.lastPaymentDate || paidAt > sub.lastPaymentDate ? paidAt : sub.lastPaymentDate,
        // A cycle that has just been paid is settled; the next one is awaiting payment.
        paymentStatus: next ? "PENDING" : matchesCurrentDue ? "PAID" : sub.paymentStatus,
        ...(next ? { nextDueDate: next } : {}),
        fieldSources: sources,
      },
    });
    if (next && res.matchedCount === 0) throw E.conflict("This subscription changed while the payment was being recorded. Reload and try again.", "infra_payment_conflict");
  } catch (e) {
    await InfraBillingRecord.deleteOne({ _id: record._id }).catch(() => undefined);
    throw e;
  }
  await audit(actor, { action: INFRA_ACTIONS.PAYMENT_CONFIRMED, resourceType: INFRA_RESOURCE.SUBSCRIPTION, resourceId: id, metadata: { assetId: sid(sub.assetId), coversDueDate: dto.coversDueDate, advanced: Boolean(next) } });
  return { id, nextDueDate: isoDate(next ?? sub.nextDueDate), advanced: Boolean(next) };
}

export async function addAdjustment(actor: InfraActor, id: string, dto: { amount: number; currency?: string; date: string; note: string }) {
  const sub = await subscriptionOf(id);
  const date = toDate(dto.date);
  if (!date) throw E.badRequest("Date is not valid.", "infra_invalid_date");
  const row = await InfraBillingRecord.create({ subscriptionId: sub._id, assetId: sub.assetId, kind: "ADJUSTMENT", amount: dec(dto.amount), currency: dto.currency ?? sub.currency, paidAt: date, note: dto.note, source: "manual", recordedByUserId: actor.userId });
  await audit(actor, { action: INFRA_ACTIONS.BILLING_ADJUSTED, resourceType: INFRA_RESOURCE.SUBSCRIPTION, resourceId: id, metadata: { recordId: sid(row._id) } });
  return { id: sid(row._id) };
}

export async function subscriptionHistory(id: string) {
  const sub = await subscriptionOf(id);
  const rows = await InfraBillingRecord.find({ subscriptionId: sub._id }).sort({ createdAt: -1 }).limit(200).lean<any[]>();
  return rows.map((r) => ({ id: sid(r._id), kind: r.kind, coversDueDate: isoDate(r.coversDueDate), paidAt: isoDate(r.paidAt), amount: money(r.amount) ?? 0, currency: r.currency, invoiceRef: r.invoiceRef ?? null, note: r.note ?? null, source: r.source, createdAt: isoTime(r.createdAt) }));
}
