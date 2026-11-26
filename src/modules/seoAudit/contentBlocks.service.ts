/**
 * Humanize the website's real page text, one block at a time, in the same format, and write it back.
 *
 * Rules the rewrite must obey (checked in code, not just asked of the AI):
 *   - same facts: no number, capitalised name or claim word that the original does not already contain
 *   - same shape: about the same length and exactly the same number of line breaks
 *   - nothing invented: when the AI cannot do this safely, the text is left as it is and the admin is told
 * Applying writes the text into the same CMS field (logged, with Undo), so the website shows exactly what was saved.
 */
import SeoFixLog from "../../models/seoFixLog.model";
import { clearDeliveryCache } from "../seo/deliveryCache";
import { rebuildWebsite } from "../../utils/rebuildWebsite";
import { toAbsoluteUrl, toCleanPath, aiAvailable, generateAiJson } from "./seoAutoFix.service";
import { fenceUntrusted, clicheAiScore } from "./seoAiContent.service";
import { ContentBlockError, listBlocks, readBlock, writeBlock, type ContentBlock } from "./contentBlocksStore";

/** Wording that reads as generic marketing copy (on top of the shared robotic-phrase list) */
const GENERIC_PHRASES = [
  "comprehensive", "seamless", "seamlessly", "holistic", "cutting-edge", "state-of-the-art", "world-class", "best-in-class", "unparalleled",
  "leverage", "tailored", "robust", "furthermore", "moreover", "in conclusion", "end-to-end", "complete support", "complete guidance",
  "dignified and reliable", "respectful, reliable", "all related arrangements", "complete assistance", "hassle-free", "one-stop",
];

/** Words that make a claim. If the rewrite uses one the original does not, it is rejected. */
const CLAIM_WORDS = [
  "licensed", "certified", "accredited", "registered", "award", "awarded", "guarantee", "guaranteed", "decades", "years", "thousands", "hundreds",
  "best", "leading", "number one", "no.1", "first", "only", "iso", "government", "insured", "affordable", "cheapest", "free", "instant", "immediately",
];

export interface FlaggedBlock extends ContentBlock {
  flagged: string[];
}

export interface HumanizeBlockResult {
  blockId: string;
  original: string;
  humanized: string;
  /** What was checked, for the admin to see */
  checks: { lengthChange: number; sameLineBreaks: boolean; noNewFacts: boolean; changed: boolean };
}

const words = (s: string): string[] => s.toLowerCase().match(/[a-z0-9ऀ-ॿ][a-z0-9ऀ-ॿ'’-]*/gi)?.map((w) => w.toLowerCase()) ?? [];
const digitsOf = (s: string): string[] => s.match(/\d+(?:[.,:/-]\d+)*/g) ?? [];

/** Why a rewrite is not acceptable, or null when it is. */
export function rewriteProblem(original: string, out: string): string | null {
  const o = original;
  const t = out;
  if (!t.trim()) return "the rewrite is empty";
  if (/<[a-z!/][^>]*>/i.test(t)) return "the rewrite contains markup";
  const lenO = o.length;
  const tol = lenO < 60 ? 0.45 : 0.2;
  if (t.length < lenO * (1 - tol) || t.length > lenO * (1 + tol)) return `the length changed too much (${lenO} -> ${t.length} characters; allowed ${Math.round(lenO * (1 - tol))} to ${Math.round(lenO * (1 + tol))})`;
  const nlO = (o.match(/\n/g) || []).length;
  const nlT = (t.match(/\n/g) || []).length;
  if (nlO !== nlT) return `the line breaks changed (${nlO} -> ${nlT}); the text must keep exactly ${nlO}`;

  // markdown the website renders (**bold**, [text](link)) must stay exactly as it is
  const count = (str: string, re: RegExp) => (str.match(re) || []).length;
  if (count(o, /\*\*/g) !== count(t, /\*\*/g)) return "the **bold** markers changed";
  if (count(o, /\]\(/g) !== count(t, /\]\(/g)) return "a link in the text changed";

  // numbers: nothing new
  const dO = new Set(digitsOf(o));
  const newDigits = digitsOf(t).filter((d) => !dO.has(d));
  if (newDigits.length) return `it added numbers that are not in the original (${newDigits.slice(0, 3).join(", ")})`;

  // names and places: no new capitalised word in the middle of a sentence
  const wO = new Set(words(o));
  const tokens = t.split(/(\s+)/);
  let sentenceStart = true;
  for (const tok of tokens) {
    if (/^\s+$/.test(tok) || !tok) continue;
    const bare = tok.replace(/^[^A-Za-zऀ-ॿ]+|[^A-Za-zऀ-ॿ]+$/g, "");
    if (bare && /^[A-Z]/.test(bare) && !sentenceStart && !wO.has(bare.toLowerCase())) return `it added a name that is not in the original ("${bare}")`;
    sentenceStart = /[.!?।]["”’)]?$/.test(tok) || /\n$/.test(tok);
  }

  // claims: nothing new
  const lo = o.toLowerCase();
  const lt = t.toLowerCase();
  for (const c of CLAIM_WORDS) {
    const re = new RegExp(`(^|[^a-z])${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i");
    if (re.test(lt) && !re.test(lo)) return `it added a claim that is not in the original ("${c}")`;
  }
  return null;
}

/** The stiff or robotic phrases a text uses (shared robotic-phrase list plus generic marketing wording) */
export function flaggedPhrasesOf(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>(clicheAiScore(text).found.map((f) => f.toLowerCase()));
  for (const g of GENERIC_PHRASES) if (lower.includes(g)) found.add(g);
  return Array.from(found);
}

export async function listFlaggedBlocks(route: string): Promise<{ pageKey: string; blocks: FlaggedBlock[] }> {
  const { pageKey, blocks } = await listBlocks(route);
  return {
    pageKey,
    blocks: blocks.map((b) => ({ ...b, flagged: flaggedPhrasesOf(b.text) })),
  };
}

const buildPrompt = (text: string, flagged: string[], retryReason?: string): string => {
  const nl = (text.match(/\n/g) || []).length;
  const lo = Math.round(text.length * (text.length < 60 ? 0.55 : 0.8));
  const hi = Math.round(text.length * (text.length < 60 ? 1.45 : 1.2));
  return `You edit text that is already on a website. Rewrite it so it sounds natural and human, without changing what it says.

ALL of these rules are mandatory:
1. Keep every fact, claim, number, name and place exactly as in the original. Add NOTHING: no new facts, promises, numbers, years, names, places, services or credentials.
2. Length: between ${lo} and ${hi} characters (the original is ${text.length}).
3. Line breaks: the original has exactly ${nl} line break(s) (the character \\n). Your text must have exactly ${nl}, in the same places.
4. Keep the same language, the same voice (we / you / our), the same punctuation style and the same capitalisation style (a Title Case headline stays Title Case).
5. Remove stiff, generic or robotic wording only by rewording it.${flagged.length ? ` These phrases in the text sound stiff or generic, so do NOT keep them: ${flagged.map((f) => `"${f}"`).join(", ")}. Say the same thing in plain, warm words.` : " If the text is already natural, return it unchanged."}
6. If the text has **bold** markers or [text](link) links, keep them exactly where they are. No other markup, no quotation marks around the text, no explanations.
${retryReason ? `\nYour previous answer was rejected because: ${retryReason}. Fix exactly that.\n` : ""}
Text to rewrite:
${fenceUntrusted(text)}

Return strictly valid JSON: {"text": string}`;
};

/** The rewritten text from whatever JSON shape the model returned ({"text": ...}, a bare string, a one-item list) */
const pickText = (res: unknown): string | null => {
  if (typeof res === "string") return res;
  if (Array.isArray(res)) return pickText(res[0]);
  if (res && typeof res === "object") {
    const o = res as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
    const first = Object.values(o).find((v) => typeof v === "string");
    return typeof first === "string" ? first : null;
  }
  return null;
};

/** Rewrites one block. Nothing is saved. */
export async function humanizeBlock(route: string, blockId: string): Promise<HumanizeBlockResult> {
  if (!aiAvailable()) throw new ContentBlockError("No AI key (GEMINI_API_KEY or OPENAI_API_KEY) is configured, so nothing can be rewritten.", 503);
  const { block } = await readBlock(route, blockId);
  const original = block.text;
  const flagged = flaggedPhrasesOf(original);

  let reason: string | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res: any = await generateAiJson(buildPrompt(original, flagged, reason), 30000);
    const raw = pickText(res);
    if (!raw) {
      reason = "no text came back: answer with exactly {\"text\": \"the rewritten text\"}";
      continue;
    }
    // the model may hand back "\n" as two characters; line breaks are real line breaks
    const out = raw.replace(/\r\n/g, "\n").replace(/\\n/g, "\n").replace(/^["“]|["”]$/g, "");
    const problem = rewriteProblem(original, out);
    if (problem) {
      reason = problem;
      continue;
    }
    // a text with stiff phrases must actually lose some of them
    if (flagged.length) {
      const left = flaggedPhrasesOf(out).filter((f) => flagged.includes(f));
      if (left.length >= flagged.length) {
        reason = `it still contains the stiff phrase(s) ${left.map((f) => `"${f}"`).join(", ")}: reword them`;
        continue;
      }
    }
    return {
      blockId,
      original,
      humanized: out,
      checks: { lengthChange: Math.round(((out.length - original.length) / Math.max(1, original.length)) * 100), sameLineBreaks: true, noNewFacts: true, changed: out !== original },
    };
  }
  throw new ContentBlockError(`The AI could not rewrite this text without changing its facts or format (${reason}). The text was left as it is.`, 422);
}

/** Saves the new text into the same CMS field. Logged, with Undo. */
export async function applyBlock(params: { route: string; blockId: string; original: string; text: string; edited?: boolean; user: string }) {
  const { route, blockId, original, text, edited, user } = params;
  if (text === original) throw new ContentBlockError("The text is the same as the current one: nothing to save.", 400);
  // AI text must pass the same checks again; text typed by the admin only has to be safe
  if (!edited) {
    const problem = rewriteProblem(original, text);
    if (problem) throw new ContentBlockError(`Not saved: ${problem}.`, 422);
  } else {
    if (!text.trim() || /<[a-z!/][^>]*>/i.test(text)) throw new ContentBlockError("Not saved: the text is empty or contains markup.", 422);
    if (text.length > Math.max(400, original.length * 3)) throw new ContentBlockError("Not saved: the text is much longer than the original.", 422);
  }

  // a text somebody changed in the meantime is refused before anything is logged
  const { block } = await readBlock(route, blockId);
  if (block.text !== original) throw new ContentBlockError("This text was changed after you opened it. Reload the page and try again.", 409);

  const cleanPath = toCleanPath(route);
  const log: any = await SeoFixLog.create({
    pageUrl: toAbsoluteUrl(route),
    route: cleanPath,
    issueType: "copy_block",
    previousValue: original,
    newValue: text,
    fixedBy: user,
    status: "failed",
    errorReason: "not completed",
    snapshot: { before: { blockId, text: original }, after: { blockId, text } },
  });
  try {
    await writeBlock(route, blockId, text, original, user);
    await SeoFixLog.updateOne({ _id: log._id }, { $set: { status: "applied" }, $unset: { errorReason: 1 } });
  } catch (err: any) {
    await SeoFixLog.updateOne({ _id: log._id }, { $set: { status: "failed", errorReason: String(err?.message).slice(0, 300) } });
    throw err;
  }
  clearDeliveryCache();
  rebuildWebsite();
  return { logId: String(log._id), route: cleanPath, blockId };
}
