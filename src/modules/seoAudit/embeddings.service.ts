/**
 * Text embeddings: one list of numbers per text that captures what the text MEANS, so two pages can be compared by their whole
 * content instead of by shared words. Uses OpenAI when its key is set, otherwise Gemini. Returns null when neither answers
 * (the caller then says so and falls back to a word-based comparison).
 */
import { env } from "../../config/env";
import { logger } from "../../utils/logger";

const MAX_CHARS = 24000; // roughly 6,000 tokens: the whole page copy fits

const normalise = (v: number[]): number[] => {
  const n = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
  return v.map((x) => x / n);
};

async function openAi(texts: string[]): Promise<number[][] | null> {
  if (!env.OPENAI_API_KEY) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "text-embedding-3-small", input: texts }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`OpenAI embeddings answered ${res.status}`);
    const data: any = await res.json();
    const rows: any[] = Array.isArray(data?.data) ? [...data.data].sort((a, b) => a.index - b.index) : [];
    if (rows.length !== texts.length) throw new Error("OpenAI returned a different number of embeddings");
    return rows.map((r) => normalise(r.embedding));
  } catch (err: any) {
    logger.warn(`[Embeddings] OpenAI failed: ${err.message}`);
    return null;
  }
}

async function gemini(texts: string[]): Promise<number[][] | null> {
  if (!env.GEMINI_API_KEY) return null;
  try {
    const model = "gemini-embedding-001";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({ requests: texts.map((t) => ({ model: `models/${model}`, content: { parts: [{ text: t }] }, taskType: "SEMANTIC_SIMILARITY" })) }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) throw new Error(`Gemini embeddings answered ${res.status}`);
    const data: any = await res.json();
    const rows: any[] = Array.isArray(data?.embeddings) ? data.embeddings : [];
    if (rows.length !== texts.length) throw new Error("Gemini returned a different number of embeddings");
    return rows.map((r) => normalise(r.values));
  } catch (err: any) {
    logger.warn(`[Embeddings] Gemini failed: ${err.message}`);
    return null;
  }
}

/** One unit-length vector per text, in the same order; null when no provider could embed them. */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  if (!texts.length) return [];
  const cut = texts.map((t) => (t.trim() ? t.slice(0, MAX_CHARS) : "empty"));
  return (await openAi(cut)) ?? (await gemini(cut));
}
