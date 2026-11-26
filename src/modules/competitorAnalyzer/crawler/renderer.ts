import { existsSync } from "node:fs";
import { logger } from "../../../utils/logger";
import { assertSafeUrl, resolvePublicAddress, type SafeFetchDeps } from "./safeFetch";
import type { Renderer } from "./crawler";

/*
 * Optional headless-browser renderer for JavaScript-only pages (adapted from the OmniPlatform reference, hardened):
 *  - used only when the static HTML looks like a JS shell
 *  - EVERY browser request is intercepted: http/https only, standard ports, public addresses only (same checks as
 *    safeFetch), GET/HEAD only (no form posts / beacons), images/media/fonts/stylesheets aborted
 *  - no downloads, service workers blocked, dialogs dismissed, bounded time and HTML size
 * Residual risk: Chromium resolves DNS itself, so a host could re-bind between our check and its connection.
 * Production should also restrict egress at the network layer (DEPLOYMENT.md).
 * Uses an installed Chrome/Edge via playwright-core (no browser download).
 */

const SCROLL_SCRIPT = `(async () => {
  const step = Math.max(400, Math.round(window.innerHeight * 0.9));
  for (let y = 0, i = 0; y < document.documentElement.scrollHeight && i < 20; y += step, i += 1) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 60));
  }
  window.scrollTo(0, 0);
})()`;

const BLOCKED_TYPES = new Set(["image", "media", "font", "stylesheet", "manifest", "texttrack", "eventsource", "websocket", "other"]);

export function browserExecutable(): string | null {
  const pf = process.env.PROGRAMFILES;
  const pf86 = process.env["PROGRAMFILES(X86)"];
  const local = process.env.LOCALAPPDATA;
  const candidates = [
    process.env.COMPETITOR_BROWSER_EXECUTABLE,
    pf && `${pf}\\Google\\Chrome\\Application\\chrome.exe`,
    pf86 && `${pf86}\\Google\\Chrome\\Application\\chrome.exe`,
    local && `${local}\\Google\\Chrome\\Application\\chrome.exe`,
    pf && `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`,
    pf86 && `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  return candidates.find((c): c is string => !!c && existsSync(c)) ?? null;
}

export const renderingEnabled = () => !/^(0|false|no|off)$/i.test(process.env.COMPETITOR_BROWSER_RENDERING_ENABLED ?? "true");

export interface RenderStats {
  allowed: number;
  blocked: { url: string; reason: string }[];
}

export interface BrowserRendererOptions {
  deps?: SafeFetchDeps;
  executablePath?: string | null;
  timeoutMs?: number;
  maxHtmlBytes?: number;
  /** Tests only (e.g. --host-resolver-rules for fixture hosts) */
  extraArgs?: string[];
  userAgent?: string;
}

export class BrowserRenderer implements Renderer {
  private browser: any = null;
  private launching: Promise<any> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  lastStats: RenderStats = { allowed: 0, blocked: [] };
  private readonly exe: string | null;

  constructor(private readonly opts: BrowserRendererOptions = {}) {
    this.exe = opts.executablePath === undefined ? browserExecutable() : opts.executablePath;
  }

  available(): boolean {
    return renderingEnabled() && !!this.exe;
  }

  private async launch() {
    if (this.browser) return this.browser;
    if (!this.launching) {
      this.launching = (async () => {
        // @ts-ignore playwright-core is optional
        const { chromium } = await import("playwright-core");
        this.browser = await chromium.launch({ executablePath: this.exe as string, headless: true, args: ["--disable-dev-shm-usage", "--no-first-run", "--disable-extensions", ...(this.opts.extraArgs ?? [])] });
        this.browser.on("disconnected", () => {
          this.browser = null;
          this.launching = null;
        });
        return this.browser;
      })().catch((e) => {
        this.launching = null;
        throw e;
      });
    }
    return this.launching;
  }

  /** Renders one page at a time (serialised) and returns the DOM HTML after scripts ran. */
  render(url: string): Promise<{ html: string; url: string }> {
    const job = this.queue.then(() => this.renderOne(url));
    this.queue = job.catch(() => undefined);
    return job;
  }

  private async renderOne(url: string): Promise<{ html: string; url: string }> {
    if (!this.available()) throw new Error("Browser rendering is not available");
    assertSafeUrl(url, this.opts.deps);
    const browser = await this.launch();
    const stats: RenderStats = { allowed: 0, blocked: [] };
    const context = await browser.newContext({ serviceWorkers: "block", acceptDownloads: false, javaScriptEnabled: true, userAgent: this.opts.userAgent, viewport: { width: 1366, height: 900 } });
    const checked = new Map<string, Promise<void>>();
    await context.route("**/*", async (route: any) => {
      const req = route.request();
      const block = (reason: string) => {
        if (stats.blocked.length < 50) stats.blocked.push({ url: String(req.url()).slice(0, 200), reason });
        return route.abort("blockedbyclient").catch(() => undefined);
      };
      try {
        const method = String(req.method()).toUpperCase();
        if (method !== "GET" && method !== "HEAD") return block(`method ${method}`);
        if (BLOCKED_TYPES.has(req.resourceType())) return block(`type ${req.resourceType()}`);
        const target = assertSafeUrl(String(req.url()), this.opts.deps);
        let check = checked.get(target.hostname);
        if (!check) {
          check = resolvePublicAddress(target.hostname, this.opts.deps).then(() => undefined);
          checked.set(target.hostname, check);
        }
        await check;
        stats.allowed += 1;
        return route.continue();
      } catch (e) {
        return block((e as Error).message.slice(0, 80));
      }
    });
    const page = await context.newPage();
    page.on("dialog", (d: any) => d.dismiss().catch(() => undefined));
    try {
      const timeout = this.opts.timeoutMs ?? 20_000;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout });
      await page.waitForLoadState("networkidle", { timeout: Math.min(8_000, timeout) }).catch(() => undefined);
      // Scroll once through the page so lazy sections render. Runs INSIDE the browser, so it is passed as a string
      // (the backend's TypeScript has no DOM types).
      await page.evaluate(SCROLL_SCRIPT).catch(() => undefined);
      await page.waitForTimeout(800);
      const html: string = await page.content();
      const max = this.opts.maxHtmlBytes ?? 2_000_000;
      return { html: html.length > max ? html.slice(0, max) : html, url: page.url() };
    } finally {
      this.lastStats = stats;
      await context.close().catch(() => undefined);
    }
  }

  async close() {
    const b = this.browser;
    this.browser = null;
    this.launching = null;
    await b?.close().catch(() => undefined);
  }
}

let shared: BrowserRenderer | null = null;
/** Process-wide renderer (lazy: the browser only starts when a JS-only page is met). */
export function sharedRenderer(): BrowserRenderer | null {
  if (!renderingEnabled()) return null;
  if (!shared) {
    shared = new BrowserRenderer({ userAgent: process.env.COMPETITOR_USER_AGENT });
    if (!shared.available()) logger.info("[competitor-analyzer] no Chrome/Edge found; JavaScript-only pages will be reported as not observed");
  }
  return shared.available() ? shared : null;
}

export async function closeSharedRenderer() {
  await shared?.close();
  shared = null;
}
