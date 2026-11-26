import type { CheckContext, CheckDefinition } from "./checks";

const usable = (ctx: CheckContext) => ctx.crawl.pages.filter((p) => p.state === "read" && p.extract && !p.extract.looksLikeJsShell && ["services", "service_detail", "pricing"].includes(p.kind));
const coverageCheck = (ctx: CheckContext, pattern: RegExp, label: string) => {
  const pages = usable(ctx);
  if (!pages.length) return { state: "unknown" as const, explanation: `No readable service/pricing pages to assess ${label}.` };
  const matched = pages.filter((p) => pattern.test(p.extract!.text) && p.extract!.wordCount >= 80);
  return { state: matched.length === pages.length ? "pass" as const : matched.length ? "warn" as const : "fail" as const,
    explanation: `${matched.length}/${pages.length} sampled service/pricing pages contain ${label} and at least 80 words. This measures observable content structure, not service quality.`, sources: pages.map((p) => p.finalUrl ?? p.url) };
};

/** Observable usefulness signals. A service name or a repeated footer alone does not earn these points. */
export const CONTENT_QUALITY_CHECKS: CheckDefinition[] = [
  { id: "SRV-006", category: "services", title: "Service process explained", description: "Process/steps described on readable service pages.", severity: "medium", weight: 3, requires: ["service_detail"], remediation: "Explain the steps from first contact to service completion on each service page.",
    evaluate: (ctx) => coverageCheck(ctx, /\b(?:our process|how it works|step\s*[1-9]|first step|process includes|process involves|service process)\b|प्रक्रिया|पहला चरण/i, "a process or steps signal") },
  { id: "SRV-007", category: "services", title: "Inclusions and requirements explained", description: "Concrete inclusion/requirement signals on readable service pages.", severity: "medium", weight: 3, requires: ["service_detail"], remediation: "List what is included, excluded and what the family needs to provide.",
    evaluate: (ctx) => coverageCheck(ctx, /\b(?:what(?:'s| is) included|inclusions|exclusions|package includes|service includes|required documents|documents required|you (?:will )?need to provide)\b|आवश्यक दस्तावेज|शामिल/i, "inclusions, exclusions or document requirements") },
  { id: "CNT-007", category: "content", title: "FAQ answers provide detail", description: "FAQ answers include useful explanatory text rather than headings only.", severity: "medium", weight: 2, requires: ["faq"], remediation: "Give clear answers with steps, requirements or scope; avoid one-line repeated answers.",
    evaluate: (ctx) => {
      const faqs = ctx.crawl.pages.filter((p) => p.state === "read" && p.extract && !p.extract.looksLikeJsShell).flatMap((p) => p.extract!.faqs.map((f) => ({ ...f, url: p.finalUrl ?? p.url })));
      if (!faqs.length) return { state: "unknown", explanation: "No extracted FAQ answers to assess; absence is not proof of poor quality." };
      const useful = faqs.filter((f) => f.answer.trim().split(/\s+/).length >= 15 && f.answer.trim().toLowerCase() !== f.question.trim().toLowerCase());
      const ratio = useful.length / faqs.length;
      return { state: ratio >= 0.8 ? "pass" : ratio >= 0.4 ? "warn" : "fail", explanation: `${useful.length}/${faqs.length} extracted FAQ answers have at least 15 words. This is a depth signal, not a correctness assessment.`, sources: [...new Set(faqs.map((f) => f.url))] };
    } },
];
