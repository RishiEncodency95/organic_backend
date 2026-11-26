/// <reference lib="dom" />
import { existsSync } from 'node:fs';
import { safeFetch, type SafeFetchDeps } from '../website-intelligence/safe-fetch';

export interface RenderedPage {
  html: string;
  url: string;
  screenshot: string | null;
}

export interface AnalyzerRenderer {
  render(url: string, screenshot?: boolean): Promise<RenderedPage>;
  close(): Promise<void>;
}

function browserExecutable() {
  const candidates = [
    process.env.COMPETITOR_BROWSER_EXECUTABLE,
    process.env.PROGRAMFILES ? `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe` : null,
    process.env['PROGRAMFILES(X86)'] ? `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe` : null,
    process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : null,
    process.env.PROGRAMFILES ? `${process.env.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe` : null,
    process.env['PROGRAMFILES(X86)'] ? `${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe` : null,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  return candidates.find((candidate): candidate is string => Boolean(candidate && existsSync(candidate))) ?? null;
}

export async function createAnalyzerRenderer(deps: SafeFetchDeps): Promise<AnalyzerRenderer | null> {
  if (process.env.NODE_ENV === 'test' || process.env.COMPETITOR_BROWSER_RENDERING_ENABLED === 'false') return null;
  const executablePath = browserExecutable();
  if (!executablePath) return null;
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--disable-quic', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'] });
  const context = await browser.newContext({
    serviceWorkers: 'block',
    userAgent: 'OrganicCompetitorAnalyzer/1.0',
    viewport: { width: 1440, height: 1000 },
  });
  await context.addInitScript(() => {
    if (typeof window.IntersectionObserver !== 'function') return;
    class AlwaysVisible {
      readonly root = null;
      readonly rootMargin = '0px';
      readonly thresholds = [0];
      constructor(private readonly callback: IntersectionObserverCallback) { }
      observe(target: Element) {
        setTimeout(() => {
          const rect = target.getBoundingClientRect();
          this.callback([{ target, isIntersecting: true, intersectionRatio: 1, boundingClientRect: rect, intersectionRect: rect, rootBounds: null, time: performance.now() }], this as unknown as IntersectionObserver);
        }, 0);
      }
      unobserve() { }
      disconnect() { }
      takeRecords() {
        return [];
      }
    }
    window.IntersectionObserver = AlwaysVisible as unknown as typeof IntersectionObserver;
  });
  const concurrency = Math.max(1, Math.min(6, Number(process.env.COMPETITOR_BROWSER_CONCURRENCY) || 4));
  let active = 0;
  const waiting: (() => void)[] = [];
  const acquire = () => new Promise<void>((resolve) => {
    if (active < concurrency) {
      active += 1;
      resolve();
      return;
    }
    waiting.push(() => {
      active += 1;
      resolve();
    });
  });
  const release = () => {
    active -= 1;
    waiting.shift()?.();
  };
  let requests = 0;
  let bytes = 0;
  // Chromium never opens an origin socket: every resource uses the pinned, redirect-checked Node client.
  await context.routeWebSocket('**/*', socket => socket.close());
  await context.route('**/*', async (route) => {
    try {
      const target = new URL(route.request().url());
      if (!['http:', 'https:'].includes(target.protocol) || !['GET', 'HEAD'].includes(route.request().method()) || ++requests > 600 || bytes > 60_000_000) {
        await route.abort('blockedbyclient');
        return;
      }
      const response = await safeFetch(target, { timeoutMs: 8000, maxBytes: 2_000_000, headers: { 'user-agent': 'OrganicCompetitorAnalyzer/1.0' } }, deps);
      if (response.truncated) { await route.abort('blockedbyclient'); return; }
      bytes += response.bodyBytes.length;
      const headers: Record<string, string> = {};
      for (const key of ['content-type', 'cache-control', 'access-control-allow-origin']) {
        const value = response.headers.get(key); if (value) headers[key] = value;
      }
      await route.fulfill({ status: response.status, headers, body: response.bodyBytes });
    } catch {
      await route.abort('blockedbyclient');
    }
  });
  return {
    async render(url, includeScreenshot = false) {
      await acquire();
      let page: Awaited<ReturnType<typeof context.newPage>> | null = null;
      try {
        page = await context.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
        await page.waitForLoadState('networkidle', { timeout: 6_000 }).catch(() => undefined);

        await page
          .evaluate(async () => {
            const step = Math.max(400, Math.round(window.innerHeight * 0.9));
            for (let y = 0, i = 0; y < document.documentElement.scrollHeight && i < 25; y += step, i += 1) {
              window.scrollTo(0, y);
              await new Promise((resolve) => setTimeout(resolve, 80));
            }
            window.scrollTo(0, 0);
          })
          .catch(() => undefined);
        await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
        await page.waitForTimeout(2_500);
        const html = await page.content();
        const screenshot = includeScreenshot
          ? `data:image/jpeg;base64,${(await page.screenshot({ type: 'jpeg', quality: 45, fullPage: false })).toString('base64')}`
          : null;
        return { html, url: page.url(), screenshot };
      } finally {
        await page?.close();
        release();
      }
    },
    async close() {
      await context.close();
      await browser.close();
    },
  };
}
