import { CompetitorRun, CompetitorStudy, SITE_SCOPE } from "../../../models/competitorAnalyzer";
import { logger } from "../../../utils/logger";
import { claimRun } from "./dispatch";
import { signalRunQueued } from "./worker";
import crypto from "node:crypto";

/*
 * Scheduled monitoring (Engine 14 / §17). Off unless COMPETITOR_SCHEDULER_ENABLED=true AND a study sets a schedule.
 *  - weekly = +7 days, monthly = +1 calendar month; due at 09:00 India time (03:30 UTC)
 *  - a due study is claimed with ONE atomic update that also moves nextScheduledAt forward, so several servers or
 *    overlapping ticks never start the same slot twice; the run gets an idempotency key per slot as a second guard
 *  - change alerts: only for scheduled runs, only evidence-backed changes, sent at most once per run (atomic marker)
 */

export type Schedule = "off" | "weekly" | "monthly";
export const MAX_ALERT_EMAILS = 5;

/** Next 09:00 IST strictly after `from` for the schedule; null when off. */
export function nextDueAt(schedule: Schedule, from: Date = new Date()): Date | null {
  if (schedule === "off") return null;
  const base = new Date(from);
  if (schedule === "weekly") base.setUTCDate(base.getUTCDate() + 7);
  else {
    const day = base.getUTCDate();
    base.setUTCDate(1);
    base.setUTCMonth(base.getUTCMonth() + 1);
    const last = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
    base.setUTCDate(Math.min(day, last));
  }
  base.setUTCHours(3, 30, 0, 0); // 09:00 IST
  return base;
}

export const schedulerEnabled = () => /^(1|true|yes|on)$/i.test(process.env.COMPETITOR_SCHEDULER_ENABLED ?? "");

/** Claims and queues every due study (bounded per tick). Returns the run ids it queued. */
export async function runDueChecks(now = new Date(), maxPerTick = 5): Promise<string[]> {
  const queued: string[] = [];
  for (let i = 0; i < maxPerTick; i += 1) {
    const token = crypto.randomUUID();
    const due = await CompetitorStudy.findOneAndUpdate({ siteScope: SITE_SCOPE, status: "active", "settings.schedule": { $in: ["weekly", "monthly"] }, nextScheduledAt: { $lte: now }, $or: [{ scheduleLease: null }, { "scheduleLease.expiresAt": { $lte: now } }] },
      { $set: { scheduleLease: { token, expiresAt: new Date(now.getTime() + 5 * 60_000) } } }, { sort: { nextScheduledAt: 1 }, returnDocument: "after" }).lean<any>();
    if (!due) break;
    const slot = new Date(due.nextScheduledAt);
    const next = nextDueAt(due.settings.schedule, now) as Date;
    try {
      const key = `sched:${String(due._id)}:${slot.toISOString()}`;
      const { run, reused } = await claimRun(String(due._id), { trigger: "scheduled", idempotencyKey: key, ignoreCooldown: true, now });
      if (run.idempotencyKey !== key) continue; // An unrelated manual run is active: retain the due slot and retry later.
      await CompetitorStudy.updateOne({ _id: due._id, nextScheduledAt: slot, "scheduleLease.token": token }, { $set: { nextScheduledAt: next, lastScheduledAt: now, scheduleLease: null } });
      if (!reused) {
        queued.push(String(run._id));
      }
      void signalRunQueued(String(run._id));
    } catch (e) {
      logger.warn(`[competitor-analyzer] scheduled check for study ${String(due._id)} not started; due slot retained for retry: ${(e as Error).message}`);
    }
  }
  return queued;
}

type Mailer = (msg: { to: string[]; subject: string; text: string; html: string }) => Promise<void>;
const smtpMailer: Mailer = async (msg) => {
  // Loaded only when an alert is actually sent (keeps the email/cloudinary import chain out of the analyzer).
  const { getTransporter } = await import("../../../services/email.service");
  const { env } = await import("../../../config/env");
  const t = getTransporter();
  if (!t) throw new Error("SMTP is not configured");
  const fromEmail = env.FROM_EMAIL || env.SMTP_USER || "noreply@bharatorganicexpo.com";
  const fromName = env.FROM_NAME || "Bharat Organic Expo";
  await t.sendMail({ from: `"${fromName}" <${fromEmail}>`, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
};

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

export function changesEmail(study: { name: string; _id: unknown }, changes: { domain: string; diff: { changes: { kind: string; subject: string; before: unknown; after: unknown }[] } }[]) {
  const link = `${(process.env.ADMIN_URL || "").replace(/\/+$/, "")}/competitor-analyzer/${String(study._id)}`;
  const lines = changes.flatMap((c) => c.diff.changes.slice(0, 15).map((x) => `${c.domain}: ${x.kind.replace(/_/g, " ")} — ${String(x.subject).slice(0, 120)}`));
  const subject = `Competitor changes detected: ${study.name}`;
  const text = `Scheduled check found ${lines.length} evidence-backed website change(s).\n\n${lines.join("\n")}\n\nOpen the report: ${link}\n\nOnly changes backed by pages read in both runs are listed; pages that could not be read are not reported as removed.`;
  const html = `<p>Scheduled check found <b>${lines.length}</b> evidence-backed website change(s) for <b>${esc(study.name)}</b>.</p><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul><p><a href="${esc(link)}">Open the report</a></p><p style="color:#64748b;font-size:12px">Only changes backed by pages read in both runs are listed.</p>`;
  return { subject, text, html, count: lines.length };
}

/** Sends the change alert for a completed scheduled run at most once. */
export async function maybeSendChangeAlert(runId: unknown, mailer: Mailer = smtpMailer): Promise<"sent" | "skipped" | "failed"> {
  const run = await CompetitorRun.findById(runId).select("studyId status trigger report.changes alert").lean<any>();
  if (!run || run.status !== "completed" || run.trigger !== "scheduled" || run.alert?.state) return "skipped";
  const study = await CompetitorStudy.findById(run.studyId).select("name settings").lean<any>();
  const recipients: string[] = (study?.settings?.alertEmails ?? []).slice(0, MAX_ALERT_EMAILS);
  const changes = (run.report?.changes ?? []).filter((c: any) => c.diff?.comparable && c.diff.changes?.length);
  if (!study?.settings?.alerts || !recipients.length || !changes.length) {
    await CompetitorRun.updateOne({ _id: run._id, "alert.state": { $exists: false } }, { $set: { alert: { state: "not_needed", at: new Date() } } });
    return "skipped";
  }
  // Atomic once-only marker before sending.
  const mark = await CompetitorRun.updateOne({ _id: run._id, "alert.state": { $exists: false } }, { $set: { alert: { state: "sending", at: new Date(), recipients: recipients.length } } });
  if (!mark.modifiedCount) return "skipped";
  const mail = changesEmail(study, changes);
  try {
    await mailer({ to: recipients, subject: mail.subject, text: mail.text, html: mail.html });
    await CompetitorRun.updateOne({ _id: run._id }, { $set: { "alert.state": "sent", "alert.sentAt": new Date(), "alert.count": mail.count } });
    return "sent";
  } catch (e) {
    await CompetitorRun.updateOne({ _id: run._id }, { $set: { "alert.state": "failed", "alert.error": (e as Error).message.slice(0, 300) } });
    return "failed";
  }
}

/** First day of next month, 09:00 IST. */
export function nextReportAt(from: Date = new Date()): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1, 3, 30, 0, 0));
}

type PdfMailer = (msg: { to: string[]; subject: string; text: string; html: string; attachments: { filename: string; content: Buffer }[] }) => Promise<void>;
const smtpPdfMailer: PdfMailer = async (msg) => {
  const { getTransporter } = await import("../../../services/email.service");
  const { env } = await import("../../../config/env");
  const t = getTransporter();
  if (!t) throw new Error("SMTP is not configured");
  const fromEmail = env.FROM_EMAIL || env.SMTP_USER || "noreply@bharatorganicexpo.com";
  const fromName = env.FROM_NAME || "Bharat Organic Expo";
  await t.sendMail({ from: `"${fromName}" <${fromEmail}>`, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html, attachments: msg.attachments });
};

/** Monthly report e-mail: one atomic claim per study per month; PDF of the latest successful run attached. */
export async function sendDueReports(now = new Date(), mailer: PdfMailer = smtpPdfMailer, maxPerTick = 5): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  // After a crash during SMTP the outcome is unknown. Keep the slot visible for review, never resend blindly.
  await CompetitorStudy.updateMany({ siteScope: SITE_SCOPE, "reportDelivery.state": "sending", "reportDelivery.expiresAt": { $lte: now } }, { $set: { "reportDelivery.state": "uncertain", "reportDelivery.error": "Worker stopped during email delivery; check delivery before retrying." } });
  for (let i = 0; i < maxPerTick; i += 1) {
    const token = crypto.randomUUID();
    const due = await CompetitorStudy.findOneAndUpdate({ siteScope: SITE_SCOPE, status: "active", "settings.monthlyReport": true, nextReportAt: { $lte: now }, $or: [
      { reportDelivery: null }, { "reportDelivery.state": "sent" },
      { "reportDelivery.state": "failed", "reportDelivery.retryAt": { $lte: now } },
      { "reportDelivery.state": "preparing", "reportDelivery.expiresAt": { $lte: now } },
    ] }, { $set: { reportDelivery: { token, state: "preparing", expiresAt: new Date(now.getTime() + 10 * 60_000) } } }, { sort: { nextReportAt: 1 }, returnDocument: "after" }).lean<any>();
    if (!due) break;
    const recipients: string[] = (due.settings?.alertEmails ?? []).slice(0, MAX_ALERT_EMAILS);
    let sending = false;
    try {
      if (!recipients.length || !due.latestSuccessfulRunId) throw new Error("Monthly report needs recipients and a completed analysis; retrying after configuration is ready.");
      const { pdfForRun } = await import("../report/export");
      const { pdf, filename } = await pdfForRun(String(due._id), String(due.latestSuccessfulRunId), "en", { allowTranslate: false });
      const link = `${(process.env.ADMIN_URL || "").replace(/\/+$/, "")}/competitor-analyzer/${String(due._id)}`;
      const mark = await CompetitorStudy.updateOne({ _id: due._id, "reportDelivery.token": token, "reportDelivery.state": "preparing" }, { $set: { "reportDelivery.state": "sending" } });
      if (!mark.modifiedCount) continue;
      sending = true;
      await mailer({ to: recipients, subject: `Monthly competitor report: ${due.name}`, text: `The latest competitor website report for ${due.name} is attached.\n\nOpen it in the admin: ${link}`, html: `<p>The latest competitor website report for <b>${esc(due.name)}</b> is attached.</p><p><a href="${esc(link)}">Open it in the admin</a></p>`, attachments: [{ filename, content: pdf }] });
      await CompetitorStudy.updateOne({ _id: due._id, nextReportAt: due.nextReportAt, "reportDelivery.token": token }, { $set: { nextReportAt: nextReportAt(now), "reportDelivery.state": "sent", "reportDelivery.sentAt": now } });
      sent += 1;
    } catch (e) {
      failed += 1;
      const error = e as Error & { code?: string; command?: string };
      const notSent = !sending || /^(ECONNECTION|ECONNREFUSED|ENOTFOUND|EAUTH)$/.test(error.code ?? "") || /SMTP is not configured/.test(error.message);
      await CompetitorStudy.updateOne({ _id: due._id, "reportDelivery.token": token }, { $set: { "reportDelivery.state": notSent ? "failed" : "uncertain", "reportDelivery.error": error.message.slice(0, 300), "reportDelivery.retryAt": new Date(now.getTime() + 5 * 60_000) } });
      logger.warn(`[competitor-analyzer] monthly report for ${String(due._id)} failed: ${(e as Error).message}`);
    }
  }
  return { sent, failed };
}

let timer: NodeJS.Timeout | null = null;
let busy = false;
export function startScheduler(intervalMs = Math.max(60_000, Number(process.env.COMPETITOR_SCHEDULER_INTERVAL_MS) || 5 * 60_000)) {
  if (timer || !schedulerEnabled()) return false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const q = await runDueChecks();
      if (q.length) logger.info(`[competitor-analyzer] scheduler queued ${q.length} run(s)`);
      const m = await sendDueReports();
      if (m.sent || m.failed) logger.info(`[competitor-analyzer] monthly reports sent=${m.sent} failed=${m.failed}`);
    } catch (e) {
      logger.error(`[competitor-analyzer] scheduler tick failed: ${(e as Error).message}`);
    } finally {
      busy = false;
    }
  };
  timer = setInterval(() => void tick(), intervalMs);
  timer.unref?.();
  void tick();
  return true;
}
export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
export const schedulerRunning = () => timer !== null;
