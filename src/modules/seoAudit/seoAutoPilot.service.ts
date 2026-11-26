import mongoose from "mongoose";
import SeoAutoPilotProposal, { IProposalItem, ISeoAutoPilotProposal, ProposalItemStatus } from "../../models/SeoAutoPilotProposal.model";
import { logger } from "../../utils/logger";
import { MAX_AUTOFIX_PAGES, loadCrawls, seoAutoFixService, toAbsoluteUrl, toPageKey, type AutoFixOptions } from "./seoAutoFix.service";

/**
 * Auto-Pilot with approval. The scheduled audit never writes to the website data: it only works out what it would change
 * (a dry run of the normal auto-fix, so every suggestion comes from the same rules and the same AI as a manual fix) and
 * saves that as a proposal. An admin approves or rejects each change; only approved changes are written, logged and can
 * be undone. A change whose page was edited after the proposal was made is not applied ("changed meanwhile").
 */

/** The fix types Auto-Pilot may suggest (each one is a normal, undoable auto-fix type) */
/** Pages prepared at the same time, and the longest one page may take */
const PAGE_CONCURRENCY = 4;
const PAGE_DEADLINE_MS = 90_000;

const ALLOWED_TYPES = new Set(["title", "description", "canonical", "og", "schema", "h1"]);

const stable = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
};

/** The options that make the normal fixer write exactly the approved value (never a fresh AI answer) */
function optionsFor(item: Pick<IProposalItem, "type" | "after">): AutoFixOptions {
  const a = item.after as any;
  switch (item.type) {
    case "title": return { metaTitle: String(a ?? "") };
    case "description": return { metaDescription: String(a ?? "") };
    case "canonical": return { canonicalUrl: String(a ?? "") };
    case "og": return a?.ogImage ? { ogImage: String(a.ogImage) } : {};
    case "schema": return { schemaMarkup: String(a ?? "") };
    case "h1": return { h1Heading: String(a ?? "") };
    default: return {};
  }
}

const counts = (items: IProposalItem[]) => {
  const c: Record<ProposalItemStatus, number> = { pending: 0, applying: 0, applied: 0, rejected: 0, stale: 0, failed: 0 };
  for (const i of items) c[i.status] += 1;
  return c;
};

const itemView = (i: IProposalItem) => ({
  id: String(i._id),
  route: i.route,
  type: i.type,
  before: i.before ?? null,
  after: i.after ?? null,
  status: i.status,
  note: i.note ?? null,
  decidedAt: i.decidedAt ? new Date(i.decidedAt).toISOString() : null,
  decidedBy: i.decidedBy ?? null,
});

const view = (p: ISeoAutoPilotProposal, withItems: boolean) => ({
  id: String(p._id),
  source: p.source,
  state: p.state,
  createdAt: new Date(p.createdAt).toISOString(),
  pagesChecked: p.pagesChecked,
  counts: counts(p.items),
  notProposed: p.notProposed ?? [],
  ...(withItems ? { items: p.items.map(itemView) } : {}),
});

export class ProposalError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const seoAutoPilotService = {
  /**
   * Looks at the latest live crawl and saves what Auto-Pilot suggests. Writes nothing to the website data.
   * An older open proposal is replaced (its suggestions were made against an older crawl).
   */
  async createProposal(
    source = "schedule",
    opts: { shouldStop?: () => void; onProgress?: (done: number, total: number) => void | Promise<void> } = {},
  ): Promise<{ proposalId: string | null; items: number; pagesChecked: number }> {
    const crawls = await loadCrawls();
    const keys = new Set<string>();
    for (const c of crawls) if (c.ok && (c.httpStatus ?? 200) < 400 && c.requestedPath) keys.add(toPageKey(c.requestedPath));
    const routes = Array.from(keys).slice(0, MAX_AUTOFIX_PAGES);

    // Pages are checked a few at a time (each may wait for an AI answer), and one slow page cannot hold the rest back.
    const perPage: Array<{ items: Array<Pick<IProposalItem, "route" | "type" | "before" | "after" | "status">>; notProposed: Array<{ route: string; reason: string }> }> = routes.map(() => ({ items: [], notProposed: [] }));
    let next = 0;
    let done = 0;
    const worker = async () => {
      for (;;) {
        opts.shouldStop?.();
        const i = next++;
        if (i >= routes.length) return;
        const route = routes[i];
        try {
          let timer: NodeJS.Timeout | undefined;
          const timeout = new Promise<null>((resolve) => {
            timer = setTimeout(() => resolve(null), PAGE_DEADLINE_MS);
            timer.unref?.();
          });
          const res = await Promise.race([seoAutoFixService.autoFixPage(toAbsoluteUrl(route), route, "all", {}, "Auto-Pilot (proposal)", { crawls, dryRun: true }), timeout]);
          clearTimeout(timer);
          if (!res) {
            perPage[i].notProposed.push({ route, reason: "error: no answer in time, nothing was suggested" });
          } else {
            for (const p of res.preview ?? []) {
              if (ALLOWED_TYPES.has(p.type)) perPage[i].items.push({ route, type: p.type, before: p.before ?? null, after: p.after ?? null, status: "pending" });
            }
            for (const [k, v] of Object.entries(res.skipped ?? {})) if (k !== "page") perPage[i].notProposed.push({ route, reason: `${k}: ${v}` });
          }
        } catch (err: any) {
          logger.warn(`[Auto-Pilot] Could not prepare suggestions for "${route}": ${err.message}`);
          perPage[i].notProposed.push({ route, reason: `error: ${String(err.message).slice(0, 160)}` });
        }
        done += 1;
        await opts.onProgress?.(done, routes.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(PAGE_CONCURRENCY, routes.length) }, worker));
    const items = perPage.flatMap((p) => p.items);
    const notProposed = perPage.flatMap((p) => p.notProposed);

    await SeoAutoPilotProposal.updateMany({ state: "open" }, { $set: { state: "superseded" } });
    if (items.length === 0 && notProposed.length === 0) return { proposalId: null, items: 0, pagesChecked: routes.length };
    const doc = await SeoAutoPilotProposal.create({
      source,
      state: items.length ? "open" : "closed",
      items,
      pagesChecked: routes.length,
      notProposed,
    });
    return { proposalId: String(doc._id), items: items.length, pagesChecked: routes.length };
  },

  /** The proposal waiting for a decision (full detail) and the latest few (summary) */
  async overview() {
    const open = (await SeoAutoPilotProposal.findOne({ state: "open" }).sort({ createdAt: -1 })) as ISeoAutoPilotProposal | null;
    const recent = (await SeoAutoPilotProposal.find({ state: { $ne: "superseded" } }).sort({ createdAt: -1 }).limit(8)) as ISeoAutoPilotProposal[];
    return {
      waiting: open ? counts(open.items).pending : 0,
      current: open ? view(open, true) : null,
      recent: recent.filter((p) => !open || String(p._id) !== String(open._id)).map((p) => view(p, false)),
    };
  },

  async waitingCount(): Promise<number> {
    const open = (await SeoAutoPilotProposal.findOne({ state: "open" }).sort({ createdAt: -1 }).select("items.status")) as ISeoAutoPilotProposal | null;
    return open ? open.items.filter((i) => i.status === "pending").length : 0;
  },

  /** Applies the approved items (each through the normal, logged, undoable fixer) and marks the rejected ones */
  async decide(proposalId: string, approveIds: string[], rejectIds: string[], actor: string) {
    if (!mongoose.isValidObjectId(proposalId)) throw new ProposalError("Invalid proposal.");
    const doc = (await SeoAutoPilotProposal.findById(proposalId)) as ISeoAutoPilotProposal | null;
    if (!doc) throw new ProposalError("This proposal does not exist any more.", 404);
    if (doc.state !== "open") throw new ProposalError("This proposal is not open any more (a newer audit replaced it, or it is already decided). Reload to see the latest.", 409);

    const approve = new Set(approveIds);
    const reject = new Set(rejectIds.filter((id) => !approve.has(id)));
    const known = new Map(doc.items.map((i) => [String(i._id), i]));
    for (const id of [...approve, ...reject]) if (!known.has(id)) throw new ProposalError("One of the selected changes is not part of this proposal.");

    const setItem = (id: string, status: ProposalItemStatus, note?: string, from: ProposalItemStatus = "pending") =>
      SeoAutoPilotProposal.updateOne(
        { _id: doc._id },
        { $set: { "items.$[el].status": status, "items.$[el].note": note ?? null, "items.$[el].decidedAt": new Date(), "items.$[el].decidedBy": actor } },
        { arrayFilters: [{ "el._id": new mongoose.Types.ObjectId(id), "el.status": from }] },
      );

    const results: Array<{ id: string; status: ProposalItemStatus; note: string | null }> = [];

    for (const id of reject) {
      const r = await setItem(id, "rejected");
      if (r.modifiedCount) results.push({ id, status: "rejected", note: null });
    }

    for (const id of approve) {
      const item = known.get(id)!;
      // claim the item first: a second click cannot apply it twice
      const claimed = await SeoAutoPilotProposal.updateOne(
        { _id: doc._id, items: { $elemMatch: { _id: item._id, status: "pending" } } },
        { $set: { "items.$.status": "applying" } },
      );
      if (!claimed.modifiedCount) {
        results.push({ id, status: item.status, note: "Already decided." });
        continue;
      }
      let status: ProposalItemStatus = "applied";
      let note: string | null = null;
      try {
        const options = optionsFor(item);
        // the page must still look as it did when this was suggested, otherwise the approval would overwrite a newer edit
        const probe = await seoAutoFixService.autoFixPage(toAbsoluteUrl(item.route), item.route, item.type, options, "Auto-Pilot (check)", { dryRun: true });
        const now = (probe.preview ?? []).find((p) => p.type === item.type);
        if (!now || stable(now.before) !== stable(item.before)) {
          status = "stale";
          note = !now ? "Already set, or no longer needed. Nothing was changed." : "This page was changed after the suggestion was made. Nothing was changed; run a new audit for a fresh suggestion.";
        } else {
          const res = await seoAutoFixService.autoFixPage(toAbsoluteUrl(item.route), item.route, item.type, options, `Auto-Pilot (approved by ${actor})`);
          if (!res.fixLogs || res.fixLogs.length === 0) {
            status = "failed";
            note = res.message || "Nothing was written.";
          }
        }
      } catch (err: any) {
        status = "failed";
        note = String(err?.message || err).slice(0, 300);
      }
      await setItem(id, status, note ?? undefined, "applying");
      results.push({ id, status, note });
    }

    const fresh = (await SeoAutoPilotProposal.findById(doc._id)) as ISeoAutoPilotProposal;
    if (!fresh.items.some((i) => i.status === "pending" || i.status === "applying")) {
      await SeoAutoPilotProposal.updateOne({ _id: doc._id, state: "open" }, { $set: { state: "closed" } });
      fresh.state = "closed";
    }
    return { results, proposal: view(fresh, true) };
  },
};
