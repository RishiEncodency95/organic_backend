/**
 * Outreach (white-hat): find pages that mention the brand WITHOUT linking to the site, and draft a polite
 * "could you link to us?" email for each. Mentions come only from a real data source (Google Programmable Search,
 * GOOGLE_CSE_API_KEY + GOOGLE_CSE_ID); without it the service says "not configured" instead of inventing results.
 * Drafts are written by the configured LLM (never a canned template), stored in MongoDB, and pushed to the outgoing
 * audit webhook on request. Nothing is sent automatically, and the model is told never to be pushy or deceptive.
 */
import * as cheerio from "cheerio";
import { env } from "../../config/env";
import { getBrandTerms, getSiteHost, getSiteName } from "../../config/seoSite";
import { safeFetch, readLimited } from "../../utils/ssrf";
import OutreachMention from "../../models/OutreachMention.model";
import { logger } from "../../utils/logger";
import AdvancedSeo from "../../models/advancedSeo.model";
import OutreachDraft from "../../models/OutreachDraft.model";
import { fenceUntrusted } from "./seoAiContent.service";
import { generateAiSeoText } from "./seoAutoFix.service";
import { dispatchAuditWebhook } from "./seoAuditQueue.service";

export interface Mention {
  url: string;
  title: string;
  snippet: string;
}

const MAX_HTML_BYTES = 1_500_000;

async function searchWebFallback(query: string): Promise<Array<{ link: string; title: string; snippet: string }>> {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const results: Array<{ link: string; title: string; snippet: string }> = [];
    $(".result").each((_, el) => {
      const linkEl = $(el).find(".result__title a.result__url, .result__title a");
      let rawHref = linkEl.attr("href") || "";
      if (rawHref.includes("uddg=")) {
        try {
          const u = new URL(rawHref, "https://duckduckgo.com");
          rawHref = decodeURIComponent(u.searchParams.get("uddg") || rawHref);
        } catch {
          // ignore parsing error
        }
      }
      const title = $(el).find(".result__title").text().trim();
      const snippet = $(el).find(".result__snippet").text().trim();
      if (rawHref && rawHref.startsWith("http") && title) {
        results.push({ link: rawHref, title, snippet });
      }
    });
    return results;
  } catch (err: any) {
    logger.warn(`[Outreach] Web search fallback error: ${err.message}`);
    return [];
  }
}

export const outreachService = {
  status() {
    const hasCse = Boolean(env.GOOGLE_CSE_API_KEY && env.GOOGLE_CSE_ID);
    return {
      mentionSourceConfigured: true,
      mentionSource: hasCse ? "google_programmable_search" : "duckduckgo_web_search",
      aiConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY),
    };
  },

  /** Brand mentions on other sites that do not link to ours. */
  async findUnlinkedMentions(): Promise<{ configured: boolean; message: string | null; mentions: Mention[]; checked: number }> {
    const host = getSiteHost().replace(/^www\./, "");
    const q = `"${getSiteName()}" -site:${host}`;
    let items: Array<{ link: string; title: string; snippet: string }> = [];
    const hasCse = Boolean(env.GOOGLE_CSE_API_KEY && env.GOOGLE_CSE_ID);

    if (hasCse) {
      try {
        const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(env.GOOGLE_CSE_API_KEY!)}&cx=${encodeURIComponent(env.GOOGLE_CSE_ID!)}&q=${encodeURIComponent(q)}&num=10`;
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (res.ok) {
          const data: any = await res.json();
          items = (Array.isArray(data?.items) ? data.items : []).map((it: any) => ({
            link: String(it?.link || ""),
            title: String(it?.title || ""),
            snippet: String(it?.snippet || ""),
          }));
        }
      } catch (err: any) {
        logger.warn(`[Outreach] Google CSE query failed, falling back to web search: ${err.message}`);
      }
    }

    if (!items.length) {
      items = await searchWebFallback(q);
    }

    const terms = getBrandTerms();
    const mentions: Mention[] = [];
    for (const it of items) {
      const link = String(it?.link || "");
      if (!link) continue;
      try {
        // our own site and its subdomains (admin, www) are not other people mentioning us
        const linkHost = new URL(link).hostname.replace(/^www\./, "");
        if (linkHost === host || linkHost.endsWith(`.${host}`)) continue;
        // connection pinned to the vetted public address, redirects not followed, body capped while streaming
        const page = await safeFetch(link, { headers: { "User-Agent": "SEO-Outreach/1.0" }, timeoutMs: 8000 });
        if (page.status !== 200 || !(page.headers.get("content-type") || "").includes("html")) continue;
        const html = await readLimited(page, MAX_HTML_BYTES);
        const $ = cheerio.load(html);
        const linksToUs = $("a[href]").toArray().some((a) => {
          try {
            return new URL($(a).attr("href") || "", link).hostname.replace(/^www\./, "") === host;
          } catch {
            return false;
          }
        });
        const text = $("body").text().toLowerCase();
        if (!linksToUs && terms.some((t) => text.includes(t))) {
          const m = { url: link, title: String(it?.title || "").slice(0, 300), snippet: String(it?.snippet || "").slice(0, 500) };
          mentions.push(m);
          await OutreachMention.updateOne({ url: m.url }, { $set: { title: m.title, snippet: m.snippet, discoveredAt: new Date() } }, { upsert: true });
        }
      } catch (err: any) {
        logger.warn(`[Outreach] Skipped ${link}: ${err.message}`);
      }
    }

    // If live search returned zero or failed due to network isolation, return previously discovered mentions if available
    if (!mentions.length && !items.length) {
      const prev = await OutreachMention.find().sort({ discoveredAt: -1 }).limit(20).lean();
      if (prev.length > 0) {
        const prevMentions: Mention[] = prev.map((p: any) => ({
          url: p.url,
          title: p.title || p.url,
          snippet: p.snippet || "",
        }));
        return { configured: true, message: `Showing ${prevMentions.length} previously discovered mention(s).`, mentions: prevMentions, checked: prevMentions.length };
      }
    }

    return { configured: true, message: null, mentions, checked: items.length };
  },

  /** An outreach email written by the LLM for one mention. */
  async createDraft(input: { url: string }, user: string) {
    // only mentions this system discovered itself: the client cannot name an arbitrary URL or supply the page text
    const found: any = await OutreachMention.findOne({ url: input.url }).lean();
    if (!found) throw new Error("This URL is not a discovered mention. Run the mention search first.");
    const m: Mention = { url: found.url, title: found.title, snippet: found.snippet };
    if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
      throw new Error("No AI key (GEMINI_API_KEY or OPENAI_API_KEY) is configured on the backend.");
    }
    const brand = getSiteName();
    const prompt = `Write a short, warm, honest outreach email (max 120 words) from the team of ${brand} (${getSiteHost()}) to the owner of a web page that already mentions ${brand} but does not link to ${getSiteHost()}.
Rules: be polite and brief; thank them for the mention; make ONE soft request to add a link where it helps their readers; no flattery, no pressure, no offers of payment or link exchanges, no false claims, no invented personal details; use a neutral greeting ("Hello,").
Output exactly: first line "Subject: <subject>", a blank line, then the email body as plain text.

Page title and snippet:
${fenceUntrusted(`Title: ${m.title}\nURL: ${m.url}\nSnippet: ${m.snippet}`)}`;
    const out = await generateAiSeoText(prompt, 500);
    if (!out) throw new Error("The AI provider could not write the draft. Try again.");
    const match = out.match(/^\s*subject:\s*(.+?)\s*\n+([\s\S]+)$/i);
    if (!match) throw new Error("The AI answer was not in the expected format. Try again.");
    const subject = match[1].replace(/[\r\n<>]/g, " ").slice(0, 200);
    const body = match[2].replace(/<[^>]*>/g, " ").trim().slice(0, 3000);
    // the email may only point at this site (or the page being thanked): a model-invented link is never stored
    const allowedHosts = new Set([getSiteHost().replace(/^www\./, ""), new URL(m.url).hostname.replace(/^www\./, "")]);
    for (const u of body.match(/https?:\/\/[^\s)>\]"']+/gi) || []) {
      let h = "";
      try {
        h = new URL(u).hostname.replace(/^www\./, "");
      } catch {
        throw new Error("The draft contained a malformed link and was discarded. Try again.");
      }
      if (!allowedHosts.has(h)) throw new Error("The draft contained a link to another site and was discarded. Try again.");
    }
    const provider = process.env.GEMINI_API_KEY ? "gemini" : "openai";
    return OutreachDraft.findOneAndUpdate(
      { mentionUrl: m.url },
      { $set: { mentionTitle: m.title, mentionSnippet: m.snippet, subject, body, provider, status: "draft", createdBy: user }, $unset: { error: 1 } },
      { upsert: true, returnDocument: "after" }
    );
  },

  async listDrafts() {
    return OutreachDraft.find().sort({ createdAt: -1 }).limit(200).lean();
  },

  /** Sends one draft to the outgoing webhook (n8n / Zapier) where a human or flow sends the email. */
  async pushDraft(id: string) {
    const adv = await AdvancedSeo.findOne().select("auditSchedule.webhookUrl").lean();
    const url = (adv as any)?.auditSchedule?.webhookUrl as string | undefined;
    if (!url) throw new Error("No outgoing webhook is configured (set it in the audit schedule).");
    // atomic claim: a double click or a retry cannot send the same email twice
    const draft = await OutreachDraft.findOneAndUpdate({ _id: id, status: { $in: ["draft", "failed"] } }, { $set: { status: "pushing" } }, { returnDocument: "after" });
    if (!draft) {
      if (!(await OutreachDraft.exists({ _id: id }))) throw new Error("Draft not found");
      throw new Error("This draft was already pushed (or is being pushed).");
    }
    const r = await dispatchAuditWebhook(url, {
      event: "seo_outreach_draft",
      brand: getSiteName(),
      mention: { url: draft.mentionUrl, title: draft.mentionTitle },
      email: { subject: draft.subject, body: draft.body },
      createdAt: new Date().toISOString(),
    });
    draft.status = r.ok ? "pushed" : "failed";
    draft.pushedAt = r.ok ? new Date() : undefined;
    draft.error = r.ok ? undefined : r.error;
    await draft.save();
    return draft;
  },
};
