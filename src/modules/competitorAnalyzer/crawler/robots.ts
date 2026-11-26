/*
 * robots.txt policy (RFC 9309 subset): groups by user-agent, Allow/Disallow with longest-match precedence, "*" and "$"
 * wildcards, Sitemap lines, Crawl-delay. The analyzer's product token is matched first, then "*".
 * Unreachable robots.txt (network error / 5xx) is treated conservatively as "unknown → crawl allowed but recorded";
 * 4xx means no restrictions (RFC 9309 §2.3.1.3). The decision is always recorded on the crawl.
 */

export interface RobotsRule {
  allow: boolean;
  pattern: string;
}

export interface RobotsPolicy {
  status: "parsed" | "missing" | "unreachable";
  rules: RobotsRule[];
  sitemaps: string[];
  crawlDelaySec: number | null;
}

export const PRODUCT_TOKEN = "mokshavoyagecompetitoranalyzer";

export function parseRobots(text: string, productToken = PRODUCT_TOKEN): RobotsPolicy {
  const groups: { agents: string[]; rules: RobotsRule[]; delay: number | null }[] = [];
  const sitemaps: string[] = [];
  let current: { agents: string[]; rules: RobotsRule[]; delay: number | null } | null = null;
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/).slice(0, 5_000)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], delay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" || key === "disallow") {
      if (key === "disallow" && !value) continue; // empty Disallow = allow all
      current.rules.push({ allow: key === "allow", pattern: value });
    } else if (key === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.delay = Math.min(n, 30);
    }
  }
  const token = productToken.toLowerCase();
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && token.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  return {
    status: "parsed",
    rules: chosen.flatMap((g) => g.rules),
    sitemaps: [...new Set(sitemaps)].slice(0, 20),
    crawlDelaySec: chosen.map((g) => g.delay).find((d) => d !== null) ?? null,
  };
}

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** Longest matching rule wins; on a tie, Allow wins. No matching rule → allowed. */
export function isAllowed(policy: RobotsPolicy, pathWithQuery: string): boolean {
  if (policy.status !== "parsed") return true;
  let best: RobotsRule | null = null;
  for (const rule of policy.rules) {
    if (!patternToRegex(rule.pattern).test(pathWithQuery)) continue;
    if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow)) best = rule;
  }
  return best ? best.allow : true;
}
