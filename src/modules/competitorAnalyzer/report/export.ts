import crypto from "node:crypto";
import { CompetitorRun, CompetitorStudy, SITE_SCOPE } from "../../../models/competitorAnalyzer";
import { AnalyzerError } from "../errors";
import { getServiceDeps } from "../competitorAnalyzer.service";
import { HINDI_PROMPT_VERSION, translatableTexts, translateToHindi, type Lang } from "./hindi";
import { renderReportPdf } from "./pdf";
import { publicReportDto } from "./share";
import { withMeasuredComparison } from "./headToHead";

/*
 * PDF export from the SAVED run. Hindi: cached translation on the run (translations.hi) is reused; a translation is
 * only requested when `allowTranslate` (authenticated export with run permission) — public share links never spend
 * AI budget. If no translation is available the Hindi PDF uses Hindi labels and states that AI text is in English.
 */

export async function pdfForRun(studyId: string, runId: string, lang: Lang, opts: { allowTranslate: boolean; public?: boolean }) {
  const [study, run] = await Promise.all([
    CompetitorStudy.findOne({ _id: studyId, siteScope: SITE_SCOPE }).select("name").lean<any>(),
    CompetitorRun.findOne({ _id: runId, studyId, siteScope: SITE_SCOPE, status: "completed" }).select("finishedAt studyConfig.name report translations").lean<any>(),
  ]);
  if (!study || !run?.report) throw new AnalyzerError(404, "RUN_NOT_FOUND", "No completed report for this run");
  run.report = withMeasuredComparison(run.report);
  const savedName = run.report.studyName ?? run.studyConfig?.name ?? "Competitor report";
  let actions = run.report.actions ?? [];
  if (opts.public) {
    const projection = publicReportDto(study, run);
    run.report = projection.report;
    actions = projection.actions;
  }
  let tr: Record<string, string> | undefined;
  let translationNote: string | null = null;
  if (lang === "hi") {
    const texts = translatableTexts(run.report);
    const cached = run.translations?.hi;
    if (cached?.promptVersion === HINDI_PROMPT_VERSION) tr = cached.map;
    const missing = texts.filter((t) => !tr?.[t]);
    if (missing.length && opts.allowTranslate && !opts.public) {
      const token = crypto.randomUUID();
      // Durable per-run lock: concurrent API processes cannot pay for the same translation twice.
      await CompetitorRun.updateOne({ _id: runId, "translationJob.state": "running", "translationJob.expiresAt": { $lt: new Date() } }, { $set: { "translationJob.state": "uncertain" } });
      const lock = await CompetitorRun.updateOne({ _id: runId, $or: [{ translationJob: null }, { "translationJob.state": { $in: ["completed", "failed"] } }] }, {
        $set: { translationJob: { token, state: "running", expiresAt: new Date(Date.now() + 10 * 60_000) } },
      });
      if (lock.modifiedCount) {
        try {
          // Re-read after taking the lock: another request may have filled the cache since our initial read.
          const latest = await CompetitorRun.findById(runId).select("translations").lean<any>();
          tr = latest?.translations?.hi?.promptVersion === HINDI_PROMPT_VERSION ? latest.translations.hi.map : tr;
          const remaining = texts.filter((t) => !tr?.[t]);
          const res = await translateToHindi(getServiceDeps().provider, remaining, { runId, studyId });
          if (res.ok) {
            tr = { ...(tr ?? {}), ...res.map };
            await CompetitorRun.updateOne({ _id: runId, "translationJob.token": token }, { $set: { translations: { ...(latest?.translations ?? {}), hi: { promptVersion: HINDI_PROMPT_VERSION, map: tr, at: new Date() } }, "translationJob.state": "completed" } });
          } else {
            await CompetitorRun.updateOne({ _id: runId, "translationJob.token": token }, { $set: { "translationJob.state": res.errorClass === "uncertain" ? "uncertain" : "failed" } });
            translationNote = `हिंदी अनुवाद उपलब्ध नहीं: ${res.error ?? "AI unavailable"}`;
          }
        } catch (error) {
          await CompetitorRun.updateOne({ _id: runId, "translationJob.token": token }, { $set: { "translationJob.state": "uncertain" } });
          throw error;
        }
      } else translationNote = "Translation is already in progress or needs usage review. Available text is shown in English.";
    }
    if (texts.some((t) => !tr?.[t]) && !translationNote) translationNote = "AI टेक्स्ट का हिंदी अनुवाद अभी उपलब्ध नहीं है; वह टेक्स्ट अंग्रेज़ी में दिखाया गया है।";
  }
  const pdf = await renderReportPdf({ lang, studyName: savedName, run, actions, tr, translationNote });
  const date = run.finishedAt ? new Date(run.finishedAt).toISOString().slice(0, 10) : "report";
  const safe = savedName.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "competitor-report";
  return { pdf, filename: `${safe}-${date}-${lang}.pdf` };
}
