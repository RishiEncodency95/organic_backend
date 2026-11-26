/**
 * Redirect rules in the formats Netlify reads at build time, and the ONE validator every redirect entry point shares
 * (admin API, auto-fix, 404 matcher, public export). Pure functions.
 */
export interface RedirectRule {
  from: string;
  to: string;
  status: number;
}

/** Characters that have a meaning in Netlify rules (splat, placeholder, query, hash) or can smuggle rules in */
const FORBIDDEN_FROM = /[*:?#\\\s\u0000-\u001f\u007f"']|%(0[0-9a-f]|1[0-9a-f]|7f|2f|5c)/i;
const FORBIDDEN_TO = /[\\\s\u0000-\u001f\u007f"']/;

/** "/Old-Page/?x=1" -> "/old-page" (what is stored and matched) */
export function normalizeFromPath(raw: string): string {
  const p = (raw || "").trim().split(/[?#]/)[0].replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
  return p.toLowerCase();
}

export function isValidFromPath(p: string): boolean {
  return typeof p === "string" && p.startsWith("/") && !p.startsWith("//") && p.length <= 512 && !FORBIDDEN_FROM.test(p) && !p.split("/").includes("..");
}

/** A path on this site, or an absolute http(s) URL (the caller still checks the host for admin-created rules) */
export function isValidToTarget(t: string): boolean {
  if (typeof t !== "string" || !t || t.length > 2048 || FORBIDDEN_TO.test(t)) return false;
  if (t.startsWith("/")) return !t.startsWith("//") && !t.split("/").includes("..");
  return /^https?:\/\/[^/]/i.test(t);
}

/** Only well-formed rules: anything else could inject rules or hijack pages. */
export function validRules(rules: RedirectRule[]): RedirectRule[] {
  return rules.filter((r) => isValidFromPath(r.from) && isValidToTarget(r.to) && [301, 302, 307, 308].includes(r.status) && r.from !== r.to);
}

/** Follows `from -> to` links among active rules; returns the final path and whether it loops back to `start`. */
export function resolveChain(start: string, to: string, rules: RedirectRule[]): { final: string; loop: boolean } {
  const map = new Map(rules.map((r) => [normalizeFromPath(r.from), r.to]));
  let cur = to;
  for (let i = 0; i < 10; i++) {
    const key = normalizeFromPath(cur);
    if (key === normalizeFromPath(start)) return { final: cur, loop: true };
    const next = map.get(key);
    if (!next) return { final: cur, loop: false };
    cur = next;
  }
  return { final: cur, loop: true };
}

/** Netlify `_redirects` file: `/from /to 301` per line. */
export function toNetlifyRedirects(rules: RedirectRule[]): string {
  const lines = validRules(rules).map((r) => `${r.from} ${r.to} ${r.status}`);
  return `# Generated from the Redirect collection: do not edit by hand\n${lines.join("\n")}${lines.length ? "\n" : ""}`;
}

/** `[[redirects]]` blocks for netlify.toml (no `force`: a real page at the same path keeps winning). */
export function toNetlifyToml(rules: RedirectRule[]): string {
  const blocks = validRules(rules).map((r) => `[[redirects]]\n  from = ${JSON.stringify(r.from)}\n  to = ${JSON.stringify(r.to)}\n  status = ${r.status}`);
  return `# Generated from the Redirect collection: do not edit by hand\n${blocks.join("\n\n")}${blocks.length ? "\n" : ""}`;
}

/** Caddy: `redir /from /to 301` per line, for a file the Caddyfile pulls in with `import` (matches the exact path). */
export function toCaddy(rules: RedirectRule[]): string {
  const lines = validRules(rules).map((r) => `redir ${r.from} ${r.to} ${r.status}`);
  return `# Generated from the Redirect collection: do not edit by hand\n${lines.join("\n")}${lines.length ? "\n" : ""}`;
}
