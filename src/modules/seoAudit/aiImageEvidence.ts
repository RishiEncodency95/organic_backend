/**
 * How a saved picture check is read, in ONE place for the whole admin (the AI picture check, the AI content matrix and
 * the image inspector): a picture counts as AI-made only with proof in the file, or with an AI estimate of
 * AI_LIKELY percent or more from the current vision question. Icons, logos and screenshots are never counted.
 */
export const AI_LIKELY = 70;
/** Bumped whenever the vision question changes: answers saved under an older version are asked again */
export const VISION_VERSION = 2;
/** Kinds of picture an AI image model would not make for a page: left out of every AI figure */
export const NOT_AI_KINDS = ["icon", "logo", "screenshot"];

/** A saved check, read the one way everywhere: proof in the file, or a current-version estimate at AI_LIKELY or more */
export function readAiCheck(d: any): { judged: boolean; provenAi: boolean; likely: boolean; likelihood: number | null; kind: string | null; reasons: string[] } {
  const signals: string[] = Array.isArray(d?.metadataSignals) ? d.metadataSignals : [];
  // older records did not store provenAi: a signal other than "carries Content Credentials" is proof
  const provenAi = typeof d?.provenAi === "boolean" ? d.provenAi : signals.some((x) => !/^Carries Content Credentials/i.test(x));
  const current = (d?.visionVersion ?? 0) >= VISION_VERSION;
  const likelihood = current && typeof d?.visionLikelihood === "number" ? d.visionLikelihood : null;
  const kind = current ? d?.visionKind ?? null : null;
  const out = kind !== null && NOT_AI_KINDS.includes(kind);
  return {
    judged: !out && (provenAi || likelihood !== null),
    provenAi,
    likely: !provenAi && !out && likelihood !== null && likelihood >= AI_LIKELY,
    likelihood,
    kind,
    reasons: current && Array.isArray(d?.visionReasons) ? d.visionReasons : [],
  };
}
