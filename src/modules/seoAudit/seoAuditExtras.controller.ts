import { Request, Response } from "express";
import { Admin } from "../../models/Admin.model";
import { z } from "zod";
import { seoAuditQueueService, consumeReportDownload } from "./seoAuditQueue.service";
import { seoExcelExportService } from "./seoExcelExport.service";
import { computePendingState } from "./seoPending.service";
import { internalLinkingService } from "./internalLinking.service";
import { notFoundService } from "./notFound.service";
import { outreachService } from "./outreach.service";
import { activeRedirectRules } from "../seo/seoDelivery.routes";
import { toNetlifyRedirects, toNetlifyToml } from "./redirectsExport";
import { seoAutoPilotService, ProposalError } from "./seoAutoPilot.service";
import { applyBlockSchema, approvalDecisionSchema, autoFixAllSchema, contentBlocksQuerySchema, humanizeBlockSchema, idParam, outreachMentionSchema, parseOr400, triggerSchema } from "./seoAudit.schemas";
import { applyBlock, humanizeBlock, listFlaggedBlocks } from "./contentBlocks.service";
import { ContentBlockError } from "./contentBlocksStore";
import { InsightError, checkPageImages, getSocial, headingsReport, keywordsForUrl, saveSocial } from "./pageInsights.service";

const actor = async (req: Request): Promise<string> => {
  const u = (req as any).user;
  if (u?.name) return u.name;
  if (u?.id) {
    const admin = await Admin.findById(u.id).select("name email").lean().catch(() => null);
    if (admin?.name) return admin.name;
    if (admin?.email) return admin.email;
  }
  return u?.email || "Admin User";
};
const fail = (res: Response, err: any, fallback: string, status = 500) =>
  res.status(status).json({ success: false, message: err?.message || fallback });

const insightFail = (res: Response, err: any, fallback: string) =>
  err instanceof InsightError ? res.status(err.status).json({ success: false, message: err.message }) : fail(res, err, fallback);
const routeQuery = z.object({ route: z.string().trim().min(1).max(300) });

export const seoAuditExtrasController = {
  // ---- page insights: headings, social share tags, keywords of an address, AI pictures ----
  async headings(_req: Request, res: Response) {
    try {
      return res.json({ success: true, data: await headingsReport() });
    } catch (err) {
      return fail(res, err, "Failed to read the headings");
    }
  },
  async socialGet(req: Request, res: Response) {
    const q = parseOr400(routeQuery, req.query, res);
    if (!q) return;
    try {
      return res.json({ success: true, data: await getSocial(q.route) });
    } catch (err) {
      return insightFail(res, err, "Failed to read the share tags");
    }
  },
  async socialSave(req: Request, res: Response) {
    const text = (max: number) => z.string().max(max).optional();
    const b = parseOr400(
      z.object({
        route: z.string().trim().min(1).max(300),
        ogTitle: text(200), ogDescription: text(300), ogImage: text(1000), ogImageAlt: text(200),
        twitterCard: text(40), twitterTitle: text(200), twitterDescription: text(300), twitterImage: text(1000),
      }).strict(),
      req.body,
      res,
    );
    if (!b) return;
    try {
      const { route, ...fields } = b;
      const out = await saveSocial(route, fields, await actor(req));
      return res.json({ success: true, data: { ...out, social: await getSocial(route) } });
    } catch (err) {
      return insightFail(res, err, "Failed to save the share tags");
    }
  },
  async keywordsFromUrl(req: Request, res: Response) {
    const b = parseOr400(z.object({ url: z.string().trim().min(4).max(2000), refresh: z.boolean().optional() }), req.body, res);
    if (!b) return;
    try {
      return res.json({ success: true, data: await keywordsForUrl(b.url, { refresh: b.refresh }) });
    } catch (err) {
      return insightFail(res, err, "Failed to read the keywords of that address");
    }
  },
  async aiImages(req: Request, res: Response) {
    const b = parseOr400(z.object({ route: z.string().trim().min(1).max(300), limit: z.number().int().min(1).max(40).optional(), force: z.boolean().optional() }), req.body, res);
    if (!b) return;
    try {
      return res.json({ success: true, data: await checkPageImages(b.route, { limit: b.limit, force: b.force }) });
    } catch (err) {
      return insightFail(res, err, "Failed to check the pictures");
    }
  },

  /** POST /api/seo-audit/trigger: queue a full audit, answer with its job id */
  async trigger(req: Request, res: Response) {
    if (!parseOr400(triggerSchema, req.body, res)) return;
    try {
      const r = await seoAuditQueueService.triggerAudit({ trigger: "manual", requestedBy: await actor(req) });
      if (r.alreadyRunning) return res.status(409).json({ success: false, alreadyRunning: true, activeJobId: r.activeJobId ?? null, message: "An audit or auto-fix run is already in progress." });
      return res.status(202).json({ success: true, data: { jobId: r.jobId, method: r.method } });
    } catch (err) {
      return fail(res, err, "Failed to queue the audit");
    }
  },

  /** POST /api/seo-audit/auto-fix-all: queues the run (never runs inside this request). 202 {jobId} or 409 {activeJobId}. */
  async autoFixAll(req: Request, res: Response) {
    const body = parseOr400(autoFixAllSchema, req.body, res);
    if (!body) return;
    try {
      const r = await seoAuditQueueService.triggerAutoFixAll({ requestedBy: await actor(req), maxPages: body.maxPages });
      if (r.alreadyRunning) return res.status(409).json({ success: false, alreadyRunning: true, activeJobId: r.activeJobId ?? null, message: "An audit or auto-fix run is already in progress." });
      return res.status(202).json({ success: true, data: { jobId: r.jobId, kind: r.kind, method: r.method } });
    } catch (err) {
      return fail(res, err, "Failed to queue auto-fix");
    }
  },

  /** GET /api/seo-audit/autopilot: the Auto-Pilot suggestions waiting for approval (and the latest decided ones) */
  async autopilotOverview(_req: Request, res: Response) {
    try {
      return res.json({ success: true, data: await seoAutoPilotService.overview() });
    } catch (err) {
      return fail(res, err, "Failed to read the Auto-Pilot suggestions");
    }
  },

  /** POST /api/seo-audit/autopilot/decide: approve (apply) and/or reject chosen suggestions */
  async autopilotDecide(req: Request, res: Response) {
    const body = parseOr400(approvalDecisionSchema, req.body, res);
    if (!body) return;
    try {
      return res.json({ success: true, data: await seoAutoPilotService.decide(body.proposalId, body.approveIds, body.rejectIds, await actor(req)) });
    } catch (err) {
      if (err instanceof ProposalError) return res.status(err.status).json({ success: false, message: err.message });
      return fail(res, err, "Failed to apply the decision");
    }
  },

  /** POST /api/seo-audit/cancel: stop the audit that is running (nothing it prepared is saved) */
  async cancel(_req: Request, res: Response) {
    try {
      const { result } = await seoAuditQueueService.cancelRunning();
      if (result === "autofix_running") return res.status(409).json({ success: false, message: "Auto-Fix All is running. It cannot be stopped halfway: every page it changes is complete and can be undone." });
      const message = result === "idle" ? "No audit is running." : result === "cleared" ? "The stuck audit was cleared." : "Stopping the audit. It ends in a moment and saves nothing.";
      return res.status(200).json({ success: true, data: { result, message } });
    } catch (err) {
      return fail(res, err, "Failed to stop the audit");
    }
  },

  /** GET /api/seo-audit/active-job: the running audit / auto-fix job, or null */
  async activeJob(_req: Request, res: Response) {
    try {
      return res.status(200).json({ success: true, data: await seoAuditQueueService.getActiveJob() });
    } catch (err) {
      return fail(res, err, "Failed to read the active job");
    }
  },

  /** GET /api/seo-audit/status/:jobId */
  async status(req: Request, res: Response) {
    const jobId = String(req.params.jobId || "");
    if (!/^[A-Za-z0-9:_-]{1,80}$/.test(jobId)) return res.status(400).json({ success: false, message: "Invalid job id" });
    try {
      return res.status(200).json({ success: true, data: await seoAuditQueueService.getJobStatus(jobId) });
    } catch (err) {
      return fail(res, err, "Failed to read the job");
    }
  },

  /** GET /api/seo-audit/pending: pending / resolved issues and the live health score */
  async pending(_req: Request, res: Response) {
    try {
      return res.status(200).json({ success: true, data: await computePendingState() });
    } catch (err) {
      return fail(res, err, "Failed to compute pending issues");
    }
  },

  /** GET /api/seo-audit/report-download?token=: the Excel report through a short-lived signed link (no login) */
  async reportDownload(req: Request, res: Response) {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token || !(await consumeReportDownload(token))) return res.status(401).json({ success: false, message: "This download link is invalid or has expired." });
    try {
      const buffer = await seoExcelExportService.generateAuditExcel();
      res.setHeader("Content-Disposition", `attachment; filename="seo-audit-${new Date().toISOString().split("T")[0]}.xlsx"`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Cache-Control", "no-store");
      return res.send(buffer);
    } catch (err) {
      return fail(res, err, "Failed to build the report");
    }
  },

  /** GET /api/seo-audit/redirects/netlify[?format=toml] */
  async netlifyRedirects(req: Request, res: Response) {
    try {
      const rules = await activeRedirectRules();
      return res.type("text/plain").send(req.query.format === "toml" ? toNetlifyToml(rules) : toNetlifyRedirects(rules));
    } catch (err) {
      return fail(res, err, "Failed to build redirects");
    }
  },

  // ---- internal linking ----
  async linksList(req: Request, res: Response) {
    try {
      return res.json({ success: true, data: await internalLinkingService.list(typeof req.query.status === "string" ? req.query.status : undefined) });
    } catch (err) {
      return fail(res, err, "Failed to load suggestions");
    }
  },
  async linksGenerate(_req: Request, res: Response) {
    try {
      return res.json({ success: true, data: await internalLinkingService.generate() });
    } catch (err) {
      return fail(res, err, "Failed to generate suggestions");
    }
  },
  async linksSetStatus(req: Request, res: Response) {
    const p = parseOr400(idParam, req.params, res);
    const b = parseOr400(z.object({ status: z.enum(["applied", "suggested", "dismissed"]) }), req.body, res);
    if (!p || !b) return;
    try {
      const doc = await internalLinkingService.setStatus(p.id, b.status, await actor(req));
      if (!doc) return res.status(404).json({ success: false, message: "Suggestion not found" });
      return res.json({ success: true, data: doc });
    } catch (err) {
      return fail(res, err, "Failed to update the suggestion");
    }
  },

  // ---- 404 log ----
  async notFoundList(req: Request, res: Response) {
    try {
      return res.json({ success: true, data: await notFoundService.list(typeof req.query.status === "string" ? req.query.status : undefined) });
    } catch (err) {
      return fail(res, err, "Failed to load the 404 log");
    }
  },
  async notFoundAutoRedirect(req: Request, res: Response) {
    try {
      return res.json({ success: true, data: await notFoundService.autoRedirectOpen(await actor(req)) });
    } catch (err) {
      return fail(res, err, "Failed to create redirects");
    }
  },
  async notFoundIgnore(req: Request, res: Response) {
    const p = parseOr400(idParam, req.params, res);
    if (!p) return;
    try {
      const doc = await notFoundService.ignore(p.id);
      if (!doc) return res.status(404).json({ success: false, message: "Entry not found" });
      return res.json({ success: true, data: doc });
    } catch (err) {
      return fail(res, err, "Failed to update the entry");
    }
  },

  // ---- outreach ----
  async outreachStatus(_req: Request, res: Response) {
    return res.json({ success: true, data: outreachService.status() });
  },
  async outreachMentions(_req: Request, res: Response) {
    try {
      return res.json({ success: true, data: await outreachService.findUnlinkedMentions() });
    } catch (err) {
      return fail(res, err, "Failed to search for mentions", 502);
    }
  },
  async outreachDraft(req: Request, res: Response) {
    const b = parseOr400(outreachMentionSchema, req.body, res);
    if (!b) return;
    try {
      return res.json({ success: true, data: await outreachService.createDraft({ url: b.url }, await actor(req)) });
    } catch (err) {
      return fail(res, err, "Failed to write the draft", 502);
    }
  },
  async outreachDrafts(_req: Request, res: Response) {
    try {
      return res.json({ success: true, data: await outreachService.listDrafts() });
    } catch (err) {
      return fail(res, err, "Failed to load drafts");
    }
  },
  async outreachPush(req: Request, res: Response) {
    const p = parseOr400(idParam, req.params, res);
    if (!p) return;
    try {
      const draft = await outreachService.pushDraft(p.id);
      return res.status(draft.status === "pushed" ? 200 : 502).json({ success: draft.status === "pushed", data: draft, message: draft.error });
    } catch (err: any) {
      return fail(res, err, "Failed to push the draft", /not found/i.test(err?.message) ? 404 : 400);
    }
  },

  // ---- page text (Humanize): the website's real CMS text, rewritten in the same format and written back ----
  /** GET /api/seo-audit/content-blocks?route=/about-us */
  async contentBlocks(req: Request, res: Response) {
    const q = parseOr400(contentBlocksQuerySchema, req.query, res);
    if (!q) return;
    try {
      const r = await listFlaggedBlocks(q.route);
      return res.json({ success: true, data: { route: q.route, pageKey: r.pageKey, total: r.blocks.length, flagged: r.blocks.filter((b) => b.flagged.length).length, blocks: r.blocks } });
    } catch (err: any) {
      return fail(res, err, "Failed to read the page text", err instanceof ContentBlockError ? err.status : 500);
    }
  },
  /** POST /api/seo-audit/content-blocks/humanize { route, blockId }: nothing is saved */
  async humanizeContentBlock(req: Request, res: Response) {
    const b = parseOr400(humanizeBlockSchema, req.body, res);
    if (!b) return;
    try {
      return res.json({ success: true, data: await humanizeBlock(b.route, b.blockId) });
    } catch (err: any) {
      return fail(res, err, "Failed to rewrite the text", err instanceof ContentBlockError ? err.status : 500);
    }
  },
  /** POST /api/seo-audit/content-blocks/apply { route, blockId, original, text, edited? } */
  async applyContentBlock(req: Request, res: Response) {
    const b = parseOr400(applyBlockSchema, req.body, res);
    if (!b) return;
    try {
      const r = await applyBlock({ ...b, user: await actor(req) });
      return res.json({ success: true, message: "Saved to the website text.", data: r });
    } catch (err: any) {
      return fail(res, err, "Failed to save the text", err instanceof ContentBlockError ? err.status : 500);
    }
  },
};
