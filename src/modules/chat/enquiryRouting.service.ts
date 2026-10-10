import Chat from "../../models/chat/Chat.model";
import EnquiryRouting from "../../models/chat/EnquiryRouting.model";
import { Admin } from "../../models/Admin.model";
import { getTransporter } from "../../services/email.service";
import { logger } from "../../utils/logger";

/*
 * Applies Notification Settings to the inbox: the team and owner of each new enquiry (by the
 * first active rule whose topic matches), the "New assignment" email, and a sweep that
 * reassigns / reports enquiries nobody answered in time. Nothing changes until the settings
 * have been saved once, so the inbox keeps its Forms & Routing behaviour until then.
 */

export type RoutingRule = {
  ruleId: number;
  topic: string;
  team: string;
  type: "Assign in Rotation" | "Fixed Employee" | "Assign by Topic" | "Least Busy";
  backup: string;
  active: boolean;
  employees: string[];
  maxOpen: number;
  during: string;
  unavailable: "Use Next Available Employee" | "Assign to Backup Owner" | "Keep in Queue";
  noneAvailable: "Queue for Team Lead" | "Assign to Backup Owner" | "Notify Admin";
  keepOwner: boolean;
  noResponse: "Notify Team Lead" | "Notify Backup Owner" | "Do Nothing";
  reassign: boolean;
  delay: string;
  lastIndex: number;
};

type AlertRow = { event?: string; email?: boolean; enabled?: boolean };
export type RoutingSettings = { rules: RoutingRule[]; unmatched: string; alerts?: { list?: AlertRow[] } };

const UNASSIGNED = "Unassigned";
const MIN = 60 * 1000;
export const DELAY_MS: Record<string, number> = { "30 minutes": 30 * MIN, "1 hour": 60 * MIN, "2 hours": 120 * MIN, "4 hours": 240 * MIN };

export const getRoutingSettings = () => EnquiryRouting.findOne({ key: "default" }).lean<RoutingSettings>();

// ─── Topic matching ──────────────────────────────────────────────────────────

// Words too general to tell topics apart ("MSME / PMS Support" must not take every support enquiry)
const GENERIC = new Set(["support", "request", "general", "enquiry", "enquiries", "query", "team", "with", "from", "meet"]);
const stem = (w: string) => w.replace(/(ies)$/, "y").replace(/s$/, "");
const words = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3).map(stem);
const keywords = (topic: string) => words(topic).filter((w) => !GENERIC.has(w) && w.length >= 4);

/** The first active rule (in the saved order) whose topic shares a key word with the text */
export const matchRule = (rules: RoutingRule[], text: string) => {
  const have = new Set(words(text));
  return rules.find((r) => r.active && keywords(r.topic).some((k) => have.has(k)));
};

// ─── Owners ──────────────────────────────────────────────────────────────────

/** Active staff by name → email */
const activeStaff = async () => {
  const list = await Admin.find({ isActive: true }).select("name email").lean<{ name?: string; email?: string }[]>();
  return new Map(list.filter((a) => a.name).map((a) => [a.name as string, a.email || ""]));
};

/** Open (not resolved, not spam) enquiries per owner */
export const openCounts = async (names: string[]) => {
  if (!names.length) return {} as Record<string, number>;
  const rows = await Chat.aggregate<{ _id: string; n: number }>([
    { $match: { "workflow.assignedTo": { $in: names }, "workflow.status": { $ne: "Resolved" }, "workflow.spam": { $ne: true } } },
    { $group: { _id: "$workflow.assignedTo", n: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.n])) as Record<string, number>;
};

type Pick = { owner: string; note: string; rotatedTo?: number };

/**
 * The employee for a new enquiry under one rule, or Unassigned (team queue).
 * `skip` leaves out the current owner when reassigning.
 */
const pickOwner = async (rule: RoutingRule, phone: string | undefined, chatId: unknown, skip?: string): Promise<Pick> => {
  const staff = await activeStaff();
  const pool = (rule.employees || []).filter((n) => staff.has(n) && n !== skip);
  const backup = rule.backup && staff.has(rule.backup) && rule.backup !== skip ? rule.backup : "";
  // The backup owner is the last resort and has no limit
  const counts = await openCounts(pool);
  const free = (n: string) => !rule.maxOpen || (counts[n] || 0) < rule.maxOpen;

  // A returning visitor stays with the person who handled them before
  if (rule.keepOwner && phone && !skip) {
    const prev = await Chat.findOne({ _id: { $ne: chatId }, "lead.phone": phone, "workflow.assignedTo": { $nin: [null, "", UNASSIGNED] } })
      .sort({ updatedAt: -1 })
      .select("workflow.assignedTo")
      .lean<any>();
    const name = prev?.workflow?.assignedTo;
    if (name && staff.has(name)) return { owner: name, note: "returning visitor, same owner" };
  }

  if (rule.type === "Assign by Topic") return { owner: UNASSIGNED, note: "team queue" };

  let pick: Pick | null = null;
  if (rule.type === "Fixed Employee") {
    const first = pool[0];
    if (first && free(first)) pick = { owner: first, note: "fixed employee" };
    else if (first && rule.unavailable === "Use Next Available Employee") {
      const next = pool.find(free);
      if (next) pick = { owner: next, note: `${first} at limit, next available` };
    } else if (first && rule.unavailable === "Assign to Backup Owner" && backup) pick = { owner: backup, note: `${first} at limit, backup owner` };
    else if (first && rule.unavailable === "Keep in Queue") return { owner: UNASSIGNED, note: `${first} at limit, kept in queue` };
  } else if (rule.type === "Least Busy") {
    const next = pool.filter(free).sort((a, b) => (counts[a] || 0) - (counts[b] || 0))[0];
    if (next) pick = { owner: next, note: `least busy (${counts[next] || 0} open)` };
  } else {
    // Rotation: the next employee after the last one given an enquiry, skipping those at their limit
    const all = rule.employees || [];
    for (let i = 1; i <= all.length; i++) {
      const idx = (((rule.lastIndex ?? -1) + i) % all.length + all.length) % all.length;
      const name = all[idx];
      if (pool.includes(name) && free(name)) {
        pick = { owner: name, note: "rotation", rotatedTo: idx };
        break;
      }
    }
  }
  if (pick) return pick;

  if (rule.noneAvailable === "Assign to Backup Owner" && backup) return { owner: backup, note: "no employee available, backup owner" };
  return { owner: UNASSIGNED, note: "no employee available, in team queue" };
};

export type Routed = { team: string; owner: string; rule?: string; note: string };

/**
 * Team and owner for a new enquiry. `text` describes it (request type, topic, category);
 * null when Notification Settings were never saved.
 */
export const routeEnquiry = async ({ text, phone, chatId }: { text: string; phone?: string; chatId?: unknown }): Promise<Routed | null> => {
  const settings = await getRoutingSettings();
  if (!settings) return null;
  const rule = matchRule(settings.rules || [], text);
  if (!rule) return { team: settings.unmatched || "General Support", owner: UNASSIGNED, note: "no matching rule, default routing" };
  const pick = await pickOwner(rule, phone, chatId);
  if (pick.rotatedTo !== undefined) {
    await EnquiryRouting.updateOne({ key: "default", "rules.ruleId": rule.ruleId }, { $set: { "rules.$.lastIndex": pick.rotatedTo } });
  }
  return { team: rule.team, owner: pick.owner, rule: rule.topic, note: pick.note };
};

// ─── Alerts ──────────────────────────────────────────────────────────────────

const alertOn = (settings: RoutingSettings | null, event: string) => {
  const row = settings?.alerts?.list?.find((a) => a.event === event);
  return Boolean(row?.enabled && row.email);
};

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const sendStaffEmail = async (name: string, subject: string, lines: string[]) => {
  const staff = await activeStaff();
  const to = staff.get(name);
  const transporter = getTransporter();
  if (!to || !transporter) return false;
  const inbox = `${(process.env.ADMIN_URL || "https://admin.ihwe.in").replace(/\/$/, "")}/chatbot/inbox`;
  try {
    await transporter.sendMail({
      from: `"${process.env.FROM_NAME || "Bharat Organic Expo"}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to,
      subject,
      html: `<p>Hi ${escapeHtml(name)},</p>${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}<p><a href="${inbox}">Open Inbox &amp; Leads</a></p>`,
    });
    return true;
  } catch (error) {
    logger.warn(`Enquiry alert email to ${name} failed: ${(error as Error).message}`);
    return false;
  }
};

/**
 * "New assignment" email to the owner, when that alert has email on. The outcome goes into
 * the enquiry's activity (`chat` picks the record).
 */
export const notifyAssignment = async (owner: string, about: { name?: string; phone?: string; topic: string }, chat?: Record<string, unknown>) => {
  if (!owner || owner === UNASSIGNED) return;
  const settings = await getRoutingSettings();
  if (!alertOn(settings, "New assignment")) return;
  const sent = await sendStaffEmail(owner, `New enquiry assigned: ${about.topic}`, [
    `A new enquiry has been assigned to you: ${about.topic}.`,
    `Visitor: ${about.name || "—"}${about.phone ? ` (${about.phone})` : ""}`,
  ]);
  if (chat) {
    const text = sent ? `New assignment email sent to ${owner}` : `New assignment email to ${owner} could not be sent (no email address or mail not set up)`;
    await Chat.updateOne(chat, { $push: { "workflow.activity": { $each: [{ kind: "event", text, by: "Notification Settings", at: new Date() }], $slice: -200 } } }, { timestamps: false });
  }
};

// ─── Overdue sweep ───────────────────────────────────────────────────────────

/**
 * Enquiries whose follow-up time has passed with no reply: reassigned to another employee
 * after the rule's delay ("Reassign after overdue delay") and/or reported to the backup owner
 * ("No Response Action"). Each enquiry is handled once (workflow.escalatedAt).
 */
export const sweepOverdueEnquiries = async () => {
  const settings = await getRoutingSettings();
  if (!settings) return { checked: 0, reassigned: 0, notified: 0 };
  let checked = 0;
  let reassigned = 0;
  let notified = 0;
  for (const rule of settings.rules || []) {
    const reassign = rule.reassign && DELAY_MS[rule.delay];
    const notify = rule.noResponse === "Notify Backup Owner" && rule.backup;
    if (!rule.active || (!reassign && !notify)) continue;
    const overdueBefore = new Date(Date.now() - (reassign ? DELAY_MS[rule.delay] : 0));
    // Nested workflow paths (Mongoose types only know the top-level fields)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const overdue: Record<string, any> = {
      "workflow.rule": rule.topic,
      "workflow.status": { $in: ["New", "Assigned"] },
      "workflow.spam": { $ne: true },
      "workflow.followUpKind": "date",
      "workflow.followUpAt": { $lt: overdueBefore },
      "workflow.escalatedAt": { $exists: false },
    };
    const chats = await Chat.find(overdue)
      .limit(50)
      .select("lead visitorName workflow.assignedTo")
      .lean<any[]>();
    for (const chat of chats) {
      checked++;
      const current = chat.workflow?.assignedTo || UNASSIGNED;
      const $set: Record<string, unknown> = { "workflow.escalatedAt": new Date(), "workflow.updatedAt": new Date() };
      const events: string[] = [];
      if (reassign) {
        const pick = await pickOwner(rule, undefined, chat._id, current === UNASSIGNED ? undefined : current);
        if (pick.owner !== UNASSIGNED && pick.owner !== current) {
          $set["workflow.assignedTo"] = pick.owner;
          $set["workflow.status"] = "Assigned";
          events.push(`No response within ${rule.delay} — reassigned from ${current} to ${pick.owner} (${pick.note})`);
          reassigned++;
          notifyAssignment(pick.owner, { name: chat.lead?.name || chat.visitorName, phone: chat.lead?.phone, topic: rule.topic }, { _id: chat._id }).catch(() => {});
        }
      }
      if (notify) {
        const sent = await sendStaffEmail(rule.backup, `Enquiry not answered in time: ${rule.topic}`, [
          `This enquiry passed its follow-up time without a reply (owner: ${current}).`,
          `Visitor: ${chat.lead?.name || chat.visitorName || "—"}${chat.lead?.phone ? ` (${chat.lead.phone})` : ""}`,
        ]);
        if (sent) notified++;
        events.push(`Follow-up overdue — backup owner ${rule.backup} ${sent ? "notified by email" : "could not be emailed"}`);
      }
      await Chat.updateOne(
        { _id: chat._id },
        { $set, ...(events.length ? { $push: { "workflow.activity": { $each: events.map((text) => ({ kind: "event", text, by: "Notification Settings", at: new Date() })), $slice: -200 } } } : {}) },
        { timestamps: false }
      );
    }
  }
  return { checked, reassigned, notified };
};

let sweepTimer: NodeJS.Timeout | null = null;
/** Runs the overdue sweep every 5 minutes */
export const startEnquirySweep = () => {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    sweepOverdueEnquiries().catch((error) => logger.warn(`Enquiry sweep failed: ${(error as Error).message}`));
  }, 5 * MIN);
  sweepTimer.unref();
};
