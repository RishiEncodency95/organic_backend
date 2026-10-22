import { Router, type Request, type Response } from "express";
import asyncHandler from "../../utils/asyncHandler";
import { isRangeKey } from "./core/server-metrics";
import { INFRA_PERM, actorOf, guard } from "./infra.access";
import { actOnAlert, alertSettings, evaluateAlerts, listAlerts, listNotifications, markNotificationsRead, updateAlertSettings } from "./infra.alerts";
import { addCertificate, refreshCertificate, refreshDomain } from "./infra.intel";
import { certRow } from "./infra.data";
import { bulkCreateDomains, certView, createDomain, createServer, getAsset, linkAssets, listAssets, removeAsset, requireAsset, setArchived, unlinkAssets, updateAsset } from "./infra.assets";
import { addAdjustment, archiveSubscription, confirmPayment, createSubscription, subscriptionHistory, updateSubscription } from "./infra.billing";
import { encryptionConfigured } from "./infra.crypto";
import { InfraAsset, InfraSslCertificate, InfraSyncRun } from "../../models/infrastructure/infrastructure.models";
import { assetMetrics, createCollector, fleetMetrics, getThresholds, monitoringStatus, revokeCollector, updateThresholds } from "./infra.monitoring";
import { dashboard, domainAnalytics, exportCsv, fleet, paymentHistory, renewals, statusSummary, subscriptionsList } from "./infra.overview";
import { catalogue, createConnection, disconnect, importServers, listConnections, remoteInstances, replaceCredentials, serverExtras, syncConnection, syncHistory, testConnection } from "./infra.providers";
import { createReport, getReport, listReports, removeReport, reportPdf } from "./infra.report";
import { enqueueRefresh } from "./infra.scheduler";
import {
  adjustmentSchema, alertActionSchema, bulkDomainsSchema, bulkRefreshSchema, certificateSchema, confirmPaymentSchema, createConnectionSchema, createDomainSchema, createReportSchema, createServerSchema,
  importServersSchema, linkSchema, parse, replaceCredentialsSchema, settingsSchema, subscriptionSchema, updateAssetSchema,
} from "./infra.schemas";
import { E, infraErrorHandler, isoTime, oid, sid } from "./infra.util";

const router = Router();
const P = INFRA_PERM;

/** 200/201/202 JSON in the platform's standard `{ success, message, data }` envelope. */
const send = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, statusCode: status, message: "OK", data, timestamp: new Date().toISOString() });
const canBilling = (req: Request) => actorOf(req).can(P.BILLING_VIEW);
const canSeeSensitive = (req: Request) => actorOf(req).can(P.INTEGRATIONS_MANAGE);
const idParam = (req: Request, name = "id") => {
  const v = req.params[name];
  return sid(oid(Array.isArray(v) ? v[0] : v, name));
};
const query = (req: Request) => Object.fromEntries(Object.entries(req.query).map(([k, v]) => [k, Array.isArray(v) ? String(v[0]) : typeof v === "string" ? v : undefined])) as Record<string, string | undefined>;

/* ----------------------------------------------------------- overview */

router.get("/dashboard", guard(P.VIEW), asyncHandler(async (req, res) => send(res, await dashboard(canBilling(req)))));

/** Compact server/domain health + nearest known date for the admin header pills. */
router.get("/status-summary", guard(P.VIEW), asyncHandler(async (_req, res) => send(res, await statusSummary())));

router.get("/capabilities", guard(P.VIEW), asyncHandler(async (req, res) => {
  const a = actorOf(req);
  send(res, {
    enabled: true,
    billingRead: a.can(P.BILLING_VIEW),
    sensitiveDns: a.can(P.INTEGRATIONS_MANAGE),
    providers: catalogue(),
    encryptionConfigured: encryptionConfigured(),
    permissions: {
      manage: a.can(P.MANAGE), billingRead: a.can(P.BILLING_VIEW), billingWrite: a.can(P.BILLING_MANAGE), integrationsRead: a.can(P.INTEGRATIONS_VIEW), integrationsWrite: a.can(P.INTEGRATIONS_MANAGE),
    },
  });
}));

/* ------------------------------------------------------------ reports */

/** Starts an infrastructure report (daily / weekly / monthly / yearly / custom). Returns at once; the client polls. */
router.post("/reports", guard(P.MANAGE), asyncHandler(async (req, res) => {
  const body = parse(createReportSchema, req.body);
  send(res, await createReport(actorOf(req), { period: (body.period ?? "monthly") as never, from: body.from, to: body.to, includeAi: body.includeAi }, canBilling(req)), 202);
}));
router.get("/reports", guard(P.VIEW), asyncHandler(async (req, res) => send(res, await listReports(actorOf(req)))));
router.get("/reports/:id/pdf", guard(P.VIEW), asyncHandler(async (req, res) => {
  const file = await reportPdf(actorOf(req), idParam(req));
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
  res.setHeader("Content-Length", String(file.buffer.length));
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(file.buffer);
}));
router.get("/reports/:id", guard(P.VIEW), asyncHandler(async (req, res) => send(res, await getReport(actorOf(req), idParam(req)))));
router.delete("/reports/:id", guard(P.MANAGE), asyncHandler(async (req, res) => send(res, await removeReport(actorOf(req), idParam(req)))));

/* ------------------------------------------------------------- assets */

/** Fleet table + summary: provider status, monitoring state and (only when measured) resource pressure per server. */
router.get("/servers/fleet", guard(P.VIEW), asyncHandler(async (req, res) => send(res, await fleet(query(req)))));
router.get("/domains/analytics", guard(P.VIEW), asyncHandler(async (_req, res) => send(res, await domainAnalytics())));
router.get("/metrics/fleet", guard(P.VIEW), asyncHandler(async (req, res) => {
  const range = typeof req.query.range === "string" ? req.query.range : undefined;
  send(res, await fleetMetrics(isRangeKey(range) ? range : "24h"));
}));
router.get("/monitoring/thresholds", guard(P.VIEW), asyncHandler(async (_req, res) => send(res, await getThresholds())));
router.put("/monitoring/thresholds", guard(P.INTEGRATIONS_MANAGE), asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) throw E.badRequest("Send an object of threshold values.");
  send(res, await updateThresholds(actorOf(req), req.body));
}));

router.get("/servers", guard(P.VIEW), asyncHandler(async (req, res) => send(res, await listAssets(query(req), canBilling(req), "SERVER"))));
router.post("/servers", guard(P.MANAGE), asyncHandler(async (req, res) => send(res, await createServer(actorOf(req), parse(createServerSchema, req.body), canBilling(req)), 201)));
router.get("/domains", guard(P.VIEW), asyncHandler(async (req, res) => send(res, await listAssets(query(req), canBilling(req), "DOMAIN"))));
router.post("/domains", guard(P.MANAGE), asyncHandler(async (req, res) => send(res, await createDomain(actorOf(req), parse(createDomainSchema, req.body), canBilling(req)), 201)));
router.post("/domains/bulk", guard(P.MANAGE), asyncHandler(async (req, res) => send(res, await bulkCreateDomains(actorOf(req), parse(bulkDomainsSchema, req.body), canBilling(req)))));
router.post("/domains/refresh", guard(P.MANAGE), asyncHandler(async (req, res) => {
  const dto = parse(bulkRefreshSchema, req.body);
  const allowed = await InfraAsset.find({ _id: { $in: dto.assetIds.map((i) => oid(i)) }, type: "DOMAIN", archivedAt: null }).select("_id").lean<any[]>();
  send(res, await enqueueRefresh(allowed.map((a) => sid(a._id))), 202);
}));

router.get("/export/:what", guard(P.VIEW), asyncHandler(async (req, res) => {
  const what = String(req.params.what);
  if (!["domains", "servers", "renewals"].includes(what)) { res.status(404).json({ success: false, message: "Unknown export.", code: "infra_unknown_export" }); return; }
  const csv = await exportCsv(what as "domains", canBilling(req));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="infrastructure-${what}.csv"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(`﻿${csv}`);
}));

router.get("/assets/:id", guard(P.VIEW), asyncHandler(async (req, res) => send(res, await getAsset(idParam(req), canBilling(req), canSeeSensitive(req)))));
router.patch("/assets/:id", guard(P.MANAGE), asyncHandler(async (req, res) => send(res, await updateAsset(actorOf(req), idParam(req), parse(updateAssetSchema, req.body), canBilling(req)))));

/* ---- server monitoring (optional guest-OS collector) and provider detail ---- */
router.get("/assets/:id/monitoring", guard(P.VIEW), asyncHandler(async (req, res) => send(res, await monitoringStatus(idParam(req)))));
router.get("/assets/:id/metrics", guard(P.VIEW), asyncHandler(async (req, res) => {
  const range = typeof req.query.range === "string" ? req.query.range : undefined;
  if (range !== undefined && !isRangeKey(range)) throw E.badRequest("range must be one of 1h, 6h, 24h, 7d, 30d.", "infra_invalid_range");
  send(res, await assetMetrics(idParam(req), (range as "24h" | undefined) ?? "24h"));
}));
router.post("/assets/:id/collector", guard(P.INTEGRATIONS_MANAGE), asyncHandler(async (req, res) => send(res, await createCollector(actorOf(req), idParam(req), typeof req.body?.label === "string" ? req.body.label : undefined), 201)));
router.delete("/assets/:id/collector", guard(P.INTEGRATIONS_MANAGE), asyncHandler(async (req, res) => send(res, await revokeCollector(actorOf(req), idParam(req)))));
router.get("/assets/:id/provider-details", guard(P.INTEGRATIONS_MANAGE), asyncHandler(async (req, res) => send(res, await serverExtras(idParam(req)))));

router.post("/assets/:id/archive", guard(P.MANAGE), asyncHandler(async (req, res) => send(res, await setArchived(actorOf(req), idParam(req), true))));
router.post("/assets/:id/restore", guard(P.MANAGE), asyncHandler(async (req, res) => send(res, await setArchived(actorOf(req), idParam(req), false))));
router.delete("/assets/:id", guard(P.MANAGE), asyncHandler(async (req, res) => send(res, await removeAsset(actorOf(req), idParam(req)))));
router.post("/assets/:id/refresh", guard(P.MANAGE), asyncHandler(async (req, res) => {
  const asset = await requireAsset(idParam(req));
  if (asset.type !== "DOMAIN") { send(res, { skipped: "Only domains have registry, DNS and SSL checks." }); return; }
  send(res, await refreshDomain(asset.id, "manual"));
}));
router.post("/assets/:id/links", guard(P.MANAGE), asyncHandler(async (req, res) => {
  const dto = parse(linkSchema, req.body);
  send(res, await linkAssets(actorOf(req), idParam(req), dto.toAssetId, dto.kind), 201);
}));
router.delete("/assets/:id/links/:relationId", guard(P.MANAGE), asyncHandler(async (req, res) => send(res, await unlinkAssets(actorOf(req), idParam(req), idParam(req, "relationId")))));

/* ------------------------------------------------------- certificates */

router.get("/certificates", guard(P.VIEW), asyncHandler(async (_req, res) => {
  const live = await InfraAsset.find({ archivedAt: null }).select("name").lean<any[]>();
  const nameOf = new Map(live.map((a) => [sid(a._id), a.name as string]));
  const rows = await InfraSslCertificate.find({ assetId: { $in: live.map((a) => a._id) } }).sort({ validTo: 1 }).limit(500).lean<any[]>();
  send(res, rows.map((c) => ({ ...certView(certRow(c)), asset: { id: sid(c.assetId), name: nameOf.get(sid(c.assetId)) ?? "", client: null } })));
}));
router.post("/certificates", guard(P.MANAGE), asyncHandler(async (req, res) => {
  const dto = parse(certificateSchema, req.body);
  const asset = await requireAsset(dto.assetId);
  send(res, { id: await addCertificate(asset.id, dto.hostname, dto.port ?? 443) }, 201);
}));
router.post("/certificates/:id/refresh", guard(P.MANAGE), asyncHandler(async (req, res) => {
  const cert = await InfraSslCertificate.findById(oid(req.params.id, "certificate id")).select("_id").lean<any>();
  if (!cert) { send(res, { notFound: true }); return; }
  send(res, await refreshCertificate(sid(cert._id), "manual"));
}));

/* ------------------------------------------------- billing & renewals */

router.get("/subscriptions", guard(P.VIEW), asyncHandler(async (req, res) => send(res, await subscriptionsList(canBilling(req)))));
router.post("/subscriptions", guard(P.BILLING_MANAGE), asyncHandler(async (req, res) => {
  const out = await createSubscription(actorOf(req), parse(subscriptionSchema, req.body));
  void evaluateAlerts().catch(() => undefined);
  send(res, out, 201);
}));
router.patch("/subscriptions/:id", guard(P.BILLING_MANAGE), asyncHandler(async (req, res) => {
  const out = await updateSubscription(actorOf(req), idParam(req), parse(subscriptionSchema, req.body));
  void evaluateAlerts().catch(() => undefined);
  send(res, out);
}));
router.delete("/subscriptions/:id", guard(P.BILLING_MANAGE), asyncHandler(async (req, res) => send(res, await archiveSubscription(actorOf(req), idParam(req)))));
router.post("/subscriptions/:id/payments", guard(P.BILLING_MANAGE), asyncHandler(async (req, res) => {
  const out = await confirmPayment(actorOf(req), idParam(req), parse(confirmPaymentSchema, req.body));
  void evaluateAlerts().catch(() => undefined);
  send(res, out, 201);
}));
router.post("/subscriptions/:id/adjustments", guard(P.BILLING_MANAGE), asyncHandler(async (req, res) => send(res, await addAdjustment(actorOf(req), idParam(req), parse(adjustmentSchema, req.body)), 201)));
router.get("/subscriptions/:id/history", guard(P.BILLING_VIEW), asyncHandler(async (req, res) => send(res, await subscriptionHistory(idParam(req)))));
router.get("/renewals", guard(P.VIEW), asyncHandler(async (req, res) => send(res, await renewals(query(req), canBilling(req)))));
router.get("/billing/payments", guard(P.BILLING_VIEW), asyncHandler(async (_req, res) => send(res, await paymentHistory())));

/* ---------------------------------------------------------- providers */

router.get("/providers", guard(P.INTEGRATIONS_VIEW), asyncHandler(async (_req, res) => send(res, await listConnections())));
router.post("/providers/connections", guard(P.INTEGRATIONS_MANAGE), asyncHandler(async (req, res) => send(res, await createConnection(actorOf(req), parse(createConnectionSchema, req.body)), 201)));
router.put("/providers/connections/:id/credentials", guard(P.INTEGRATIONS_MANAGE), asyncHandler(async (req, res) => send(res, await replaceCredentials(actorOf(req), idParam(req), parse(replaceCredentialsSchema, req.body).credentials))));
router.post("/providers/connections/:id/test", guard(P.INTEGRATIONS_MANAGE), asyncHandler(async (req, res) => send(res, await testConnection(actorOf(req), idParam(req)))));
router.post("/providers/connections/:id/sync", guard(P.INTEGRATIONS_MANAGE), asyncHandler(async (req, res) => send(res, await syncConnection(idParam(req), "manual", actorOf(req)))));
router.get("/providers/connections/:id/instances", guard(P.INTEGRATIONS_MANAGE), asyncHandler(async (req, res) => send(res, await remoteInstances(idParam(req)))));
router.post("/providers/connections/:id/import", guard(P.INTEGRATIONS_MANAGE), asyncHandler(async (req, res) => send(res, await importServers(actorOf(req), idParam(req), parse(importServersSchema, req.body)))));
router.get("/providers/connections/:id/runs", guard(P.INTEGRATIONS_VIEW), asyncHandler(async (req, res) => send(res, await syncHistory(idParam(req)))));
router.delete("/providers/connections/:id", guard(P.INTEGRATIONS_MANAGE), asyncHandler(async (req, res) => send(res, await disconnect(actorOf(req), idParam(req)))));

/* ------------------------------------------------- alerts & settings */

router.get("/alerts", guard(P.VIEW), asyncHandler(async (req, res) => {
  const q = query(req);
  send(res, await listAlerts({ state: q.state, kind: q.kind, page: Number(q.page) || 1, limit: Number(q.limit) || 25 }));
}));
router.post("/alerts/:id/action", guard(P.MANAGE), asyncHandler(async (req, res) => {
  const dto = parse(alertActionSchema, req.body);
  send(res, await actOnAlert(actorOf(req), idParam(req), dto.action, dto.snoozeDays));
}));
router.get("/settings", guard(P.VIEW), asyncHandler(async (_req, res) => send(res, await alertSettings())));
router.put("/settings", guard(P.INTEGRATIONS_MANAGE), asyncHandler(async (req, res) => send(res, await updateAlertSettings(actorOf(req), parse(settingsSchema, req.body)))));

router.get("/activity", guard(P.VIEW), asyncHandler(async (_req, res) => {
  const rows = await InfraSyncRun.find({}).sort({ startedAt: -1 }).limit(50).lean<any[]>();
  send(res, rows.map((r) => ({ id: sid(r._id), kind: r.kind, status: r.status, trigger: r.trigger, startedAt: isoTime(r.startedAt), finishedAt: isoTime(r.finishedAt), stats: r.stats ?? null, error: r.error ?? null })));
}));

/* ------------------------------------------------ in-app notifications */

router.get("/notifications", guard(P.VIEW), asyncHandler(async (req, res) => send(res, await listNotifications(actorOf(req).userId))));
router.post("/notifications/read", guard(P.VIEW), asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? (req.body.ids as unknown[]).filter((i): i is string => typeof i === "string").slice(0, 100) : undefined;
  send(res, await markNotificationsRead(actorOf(req).userId, ids));
}));

router.use(infraErrorHandler);

export default router;
