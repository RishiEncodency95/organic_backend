/**
 * Keeping an eye on competitors: schedules, action-plan progress and the e-mails that go with them. Pure helpers.
 */

import { createHash } from 'node:crypto';
import type { SiteChange } from './analyzer-changes';

export type Schedule = 'off' | 'weekly' | 'monthly';
export interface StudySettings {
  schedule: Schedule;
  /** E-mail the change list to `reportEmails` after every scheduled check that found changes. */
  alerts: boolean;
  reportEmails: string[];
  /** E-mail the PDF report to `reportEmails` on the 1st of every month. */
  reportMonthly: boolean;
}

export const DEFAULT_SETTINGS: StudySettings = { schedule: 'off', alerts: false, reportEmails: [], reportMonthly: false };
export const MAX_REPORT_EMAILS = 5;
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

export function readSettings(raw: unknown): StudySettings {
  const v = (raw ?? {}) as Partial<StudySettings>;
  return {
    schedule: v.schedule === 'weekly' || v.schedule === 'monthly' ? v.schedule : 'off',
    alerts: v.alerts === true,
    reportEmails: Array.isArray(v.reportEmails) ? [...new Set(v.reportEmails.filter((e): e is string => typeof e === 'string' && EMAIL.test(e.trim())).map((e) => e.trim().toLowerCase()))].slice(0, MAX_REPORT_EMAILS) : [],
    reportMonthly: v.reportMonthly === true,
  };
}

export function validEmail(value: string) {
  return EMAIL.test(value.trim()) && value.length <= 254;
}

/** Scheduled checks run at 03:30 UTC (09:00 India time): 7 or 30 days after `from`. */
export function nextCheckAt(schedule: Schedule, from = new Date()): Date | null {
  if (schedule === 'off') return null;
  const next = new Date(from.getTime() + (schedule === 'weekly' ? 7 : 30) * 86_400_000);
  next.setUTCHours(3, 30, 0, 0);
  return next;
}

/** The monthly report goes out on the 1st of the next month at 03:30 UTC (09:00 India time). */
export function nextReportAt(from = new Date()): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1, 3, 30));
}

/** Stable key for an action across re-checks with the same wording. */
export function actionKey(action: string) {
  return createHash('sha1').update(action.trim().toLowerCase().replace(/\s+/g, ' ')).digest('hex').slice(0, 16);
}

export type ActionStatus = 'todo' | 'doing' | 'done';
export interface ActionState { status: ActionStatus; action: string; taskId?: string | null; updatedAt: string; updatedBy?: string | null }

export function readActions(raw: unknown): Record<string, ActionState> {
  const out: Record<string, ActionState> = {};
  for (const [k, v] of Object.entries((raw ?? {}) as Record<string, any>)) {
    if (!/^[a-f0-9]{16}$/.test(k) || !v || typeof v !== 'object') continue;
    out[k] = { status: ['todo', 'doing', 'done'].includes(v.status) ? v.status : 'todo', action: String(v.action ?? '').slice(0, 300), taskId: typeof v.taskId === 'string' ? v.taskId : null, updatedAt: String(v.updatedAt ?? ''), updatedBy: typeof v.updatedBy === 'string' ? v.updatedBy : null };
  }
  return out;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function frame(title: string, body: string, link: string | null) {
  return `<!doctype html><html><body style="margin:0;background:#F4F6FA;font-family:Segoe UI,Arial,sans-serif;color:#28354C">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E6EBF4">
<tr><td style="background:#2563EB;padding:18px 24px;color:#fff;font-size:12px;letter-spacing:2px;font-weight:bold">COMPETITOR ANALYZER</td></tr>
<tr><td style="padding:24px"><h1 style="margin:0 0 12px;font-size:20px;color:#111C3A">${esc(title)}</h1>${body}
${link ? `<p style="margin:24px 0 0"><a href="${esc(link)}" style="background:#2563EB;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:bold;font-size:14px">Open the analysis</a></p>` : ''}</td></tr>
<tr><td style="padding:14px 24px;background:#F8FAFD;color:#94A3B8;font-size:11px">Sent by Competitor Analyzer. Based only on public pages and Google measurements.</td></tr>
</table></td></tr></table></body></html>`;
}

export function changesEmail(input: { studyName: string; changes: SiteChange[]; link: string | null }) {
  const subject = `${input.changes.length} change${input.changes.length === 1 ? '' : 's'} on your competitors - ${input.studyName}`.slice(0, 180);
  const rows = input.changes
    .map((c) => `<li style="margin:0 0 8px"><b style="color:${c.direction === 'up' ? '#0B845C' : c.direction === 'down' ? '#C0261F' : '#5B6B85'}">${c.direction === 'up' ? '&#9650;' : c.direction === 'down' ? '&#9660;' : '&#8226;'}</b> <b>${esc(c.domain)}</b>: ${esc(c.text)}</li>`)
    .join('');
  const text = [`Changes found in "${input.studyName}":`, ...input.changes.map((c) => `- ${c.domain}: ${c.text}`), input.link ? `Open: ${input.link}` : ''].join('\n');
  return { subject, html: frame('What changed since the last check', `<p>The latest automatic check of <b>${esc(input.studyName)}</b> found these changes:</p><ul style="padding-left:18px">${rows}</ul>`, input.link), text };
}

export function reportEmail(input: { studyName: string; ownDomain: string; headline: string | null; score: number | null; rank: number | null; total: number; link: string | null }) {
  const subject = `Competitor report: ${input.ownDomain} - ${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`;
  const stats = input.score != null ? `<p style="font-size:15px">Overall score <b style="color:#2563EB">${input.score}/100</b>${input.rank ? `, rank <b>#${input.rank} of ${input.total}</b>` : ''}.</p>` : '';
  const html = frame(`Competitor report for ${input.ownDomain}`, `${input.headline ? `<p style="font-size:15px;font-style:italic">${esc(input.headline)}</p>` : ''}${stats}<p>The full PDF report is attached: scorecard, head-to-head, SWOT, topics, speed, a 90-day plan and KPIs.</p>`, input.link);
  const text = [`Competitor report for ${input.ownDomain} (${input.studyName}).`, input.headline ?? '', input.score != null ? `Overall score ${input.score}/100${input.rank ? `, rank #${input.rank} of ${input.total}` : ''}.` : '', 'The PDF report is attached.', input.link ? `Open: ${input.link}` : ''].filter(Boolean).join('\n');
  return { subject, html, text };
}
