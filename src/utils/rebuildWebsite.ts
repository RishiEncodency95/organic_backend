import { env } from "../config/env";
import { logger } from "./logger";

/**
 * Starts a new build of the website through its deploy hook (Netlify: Site settings → Build & deploy →
 * Build hooks). The website is a static export, so the SEO tags in its HTML (title, description,
 * canonical, Open Graph image, schema) — the only part WhatsApp, Facebook and other link previews
 * read — change only when it is built again. Saves made close together start a single build.
 * Fire-and-forget: never throws, never delays the admin response. Skipped when
 * WEBSITE_BUILD_HOOK_URL is not set.
 */
const DEBOUNCE_MS = 30 * 1000;
let timer: NodeJS.Timeout | undefined;
let warnedNoHook = false;

export const rebuildWebsite = (): void => {
  const hook = env.WEBSITE_BUILD_HOOK_URL;
  if (!hook) {
    // The site is a static export: a saved SEO change reaches its pages only when the website is built again. Without the
    // hook nothing asks for that build, so say so (once) instead of staying silent.
    if (!warnedNoHook) {
      warnedNoHook = true;
      logger.warn("[rebuildWebsite] WEBSITE_BUILD_HOOK_URL is not set: SEO changes are saved, but the website is not rebuilt automatically. Build / deploy the website to publish them.");
    }
    return;
  }

  clearTimeout(timer);
  timer = setTimeout(() => {
    fetch(hook, { method: "POST", signal: AbortSignal.timeout(10000) })
      .then((res) => {
        if (!res.ok) console.warn(`[rebuildWebsite] build hook responded ${res.status}`);
      })
      .catch((err) => console.warn("[rebuildWebsite] failed:", err?.message || err));
  }, DEBOUNCE_MS);
  timer.unref?.();
};
