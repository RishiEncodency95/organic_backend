import OpenAI from "openai";
import mammoth from "mammoth";
import ChatbotConfig from "../../models/chat/ChatbotConfig.model";
import KnowledgeSource from "../../models/chat/KnowledgeSource.model";
import { env } from "../../config/env";
import { buildInstructions, NO_ANSWER_MARKER, type BotContext } from "../chat/chat.prompt";
// pdf-parse has no type definitions (same import as the Udyam extraction service)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

/** Sections the Chatbot Manager saves; each is the admin panel's own JSON */
export const CONFIG_SECTIONS = ["buttons", "answers", "forms", "rules", "settings"] as const;
export type ConfigSection = (typeof CONFIG_SECTIONS)[number];

type ManagerAnswer = { question?: string; status?: string; phrases?: string[]; answer?: { en?: string; hi?: string } };
type ManagerSettings = {
  identity?: { name?: string; subtitle?: string; launcher?: string };
  enabled?: boolean;
  languages?: string[];
  defaultLang?: string;
  messages?: Record<"en" | "hi", { welcomeGreeting?: string; welcomeMessage?: string; closingGreeting?: string; unknownAnswer?: string }>;
  team?: { timezone?: string; days?: string; from?: string; to?: string; outside?: string };
};
type ConfigData = Partial<Record<ConfigSection, unknown>>;

const MAX_SOURCE_TEXT = 30_000;

let openai: OpenAI | null = null;
export const getOpenAI = (): OpenAI | null => {
  if (!env.OPENAI_API_KEY) return null;
  if (!openai) openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return openai;
};

/** The single config document, created on first use */
export const getConfigDoc = async () =>
  ChatbotConfig.findOneAndUpdate({ key: "main" }, { $setOnInsert: { key: "main" } }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true });

// The website asks for the live context on every message — cache it briefly
let liveCache: { at: number; ctx: BotContext; settings: ManagerSettings } | null = null;
const LIVE_CACHE_MS = 30_000;
export const clearLiveCache = () => {
  liveCache = null;
};

const toContext = (data: ConfigData, sources: { name: string; topic?: string; content: string }[]): BotContext => {
  const settings = (data.settings || {}) as ManagerSettings;
  const answers = ((data.answers as ManagerAnswer[]) || [])
    .filter((a) => a.status === "Approved" && a.question?.trim() && (a.answer?.en?.trim() || a.answer?.hi?.trim()))
    .map((a) => ({ question: a.question!.trim(), phrases: a.phrases, en: a.answer?.en?.trim(), hi: a.answer?.hi?.trim() }));
  return {
    botName: settings.identity?.name,
    unknownAnswer: { en: settings.messages?.en?.unknownAnswer, hi: settings.messages?.hi?.unknownAnswer },
    answers,
    sources: sources.filter((s) => s.content.trim()),
  };
};

/** What the bot knows: "live" = published (website), "draft" = everything being edited (admin tests) */
export const getBotContext = async (mode: "live" | "draft" = "live"): Promise<{ ctx: BotContext; settings: ManagerSettings }> => {
  if (mode === "live" && liveCache && Date.now() - liveCache.at < LIVE_CACHE_MS) return liveCache;
  const doc = await getConfigDoc();
  const data = ((mode === "live" ? doc.published : doc.draft) || {}) as ConfigData;
  const rows = await KnowledgeSource.find(mode === "live" ? { status: { $ne: "Draft" } } : {})
    .sort({ createdAt: 1 })
    .select("name topic content pendingContent status")
    .lean();
  // Live keeps the published text of a source whose update is still waiting for review
  const sources = rows.map((s) => ({
    name: s.name,
    topic: s.topic,
    content: (mode === "draft" && s.pendingContent ? s.pendingContent : s.content) || "",
  }));
  const result = { ctx: toContext(data, sources), settings: (data.settings || {}) as ManagerSettings };
  if (mode === "live") liveCache = { at: Date.now(), ...result };
  return result;
};

/** Published settings the website chat needs (name, greetings, on/off) */
export const getPublicSettings = async () => {
  const { settings } = await getBotContext("live");
  return {
    enabled: settings.enabled !== false,
    name: settings.identity?.name || "",
    subtitle: settings.identity?.subtitle || "",
    launcher: settings.identity?.launcher || "",
    defaultLanguage: settings.defaultLang || "",
    messages: settings.messages || null,
    outsideHours: settings.team?.outside || "",
  };
};

// ─── Knowledge extraction ────────────────────────────────────────────────────

const decodeEntities = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

/** Readable text of an HTML page (scripts, styles and markup removed) */
const htmlToText = (html: string) =>
  decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();

/** Internal addresses (the server's own network) are never fetched */
const isPrivateHost = (host: string) =>
  /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:)/i.test(host) || host.endsWith(".local") || host.endsWith(".internal");

const fetchPage = async (url: string) => {
  if (isPrivateHost(new URL(url).hostname)) throw new Error("Internal network addresses cannot be imported.");
  const res = await fetch(url, {
    headers: { "User-Agent": "OrganicMitraBot/1.0 (+https://bharatorganicexpo.com)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`The page returned HTTP ${res.status}.`);
  return res.text();
};

/** Text of a website page, plus up to 5 linked pages on the same site when asked */
export const extractWebText = async (rawUrl: string, includeLinked = false): Promise<string> => {
  const url = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Only http(s) website addresses can be imported.");
  const html = await fetchPage(url.href);
  const parts = [htmlToText(html)];

  if (includeLinked) {
    const links = new Set<string>();
    for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
      try {
        const link = new URL(m[1], url);
        if (link.origin === url.origin && link.href !== url.href && !/\.(pdf|jpe?g|png|webp|gif|svg|zip|css|js)$/i.test(link.pathname)) links.add(link.href);
      } catch {
        // ignore malformed links
      }
      if (links.size >= 5) break;
    }
    for (const link of links) {
      try {
        parts.push(`[${new URL(link).pathname}]\n${htmlToText(await fetchPage(link))}`);
      } catch {
        // a linked page that fails is skipped
      }
    }
  }
  const text = parts.join("\n\n").slice(0, MAX_SOURCE_TEXT);
  if (!text.trim()) throw new Error("No readable text was found on this page.");
  return text;
};

/** Text of an uploaded PDF, DOCX or TXT document */
export const extractFileText = async (buffer: Buffer, filename: string): Promise<string> => {
  const ext = filename.toLowerCase().split(".").pop();
  let text = "";
  if (ext === "pdf") text = (await pdfParse(buffer)).text || "";
  else if (ext === "docx") text = (await mammoth.extractRawText({ buffer })).value || "";
  else if (ext === "txt") text = buffer.toString("utf8");
  else throw new Error("Only PDF, DOCX or TXT files can be imported.");
  text = text.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim().slice(0, MAX_SOURCE_TEXT);
  if (!text) throw new Error("No readable text was found in this document (scanned PDFs are not supported).");
  return text;
};

// ─── Test / preview replies ──────────────────────────────────────────────────

/** One reply from the bot (not streamed) — used by the admin panel's tests and preview */
export const askBot = async (opts: {
  question: string;
  mode: "live" | "draft";
  language?: string;
  history?: { role: "user" | "assistant"; content: string }[];
}): Promise<{ text: string; found: boolean }> => {
  const client = getOpenAI();
  if (!client) throw new Error("OPENAI_API_KEY is not configured on the server.");
  const { ctx } = await getBotContext(opts.mode);
  const model = env.OPENAI_MODEL;
  const languageHint =
    opts.language && opts.language !== "Auto" ? `\n\nReply in ${opts.language === "हिंदी" ? "Hindi" : opts.language}.` : "";
  const response = await client.responses.create({
    model,
    instructions: buildInstructions(undefined, ctx) + languageHint,
    input: [...(opts.history || []).slice(-10), { role: "user" as const, content: opts.question }],
    max_output_tokens: 800,
    ...(/^(gpt-5|o\d)/.test(model) ? { reasoning: { effort: "low" as const } } : {}),
  });
  const raw = response.output_text || "";
  const found = !raw.includes(NO_ANSWER_MARKER);
  return { text: raw.split(NO_ANSWER_MARKER).join("").trim(), found };
};
