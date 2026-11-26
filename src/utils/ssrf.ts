import dns from "dns/promises";
import net from "net";
import { Agent, fetch as undiciFetch } from "undici";

/** The 16 bytes of an IPv6 address (handles "::" and a dotted IPv4 tail), or null when it is not valid */
function ipv6Bytes(addr: string): number[] | null {
  let a = addr.toLowerCase().replace(/%.*$/, "");
  const dotted = a.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    if (!net.isIPv4(dotted[1])) return null;
    const [p, q, r, t] = dotted[1].split(".").map(Number);
    a = a.slice(0, a.length - dotted[1].length) + ((p << 8) | q).toString(16) + ":" + ((r << 8) | t).toString(16);
  }
  const halves = a.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (groups.length !== 8) return null;
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    const v = parseInt(g, 16);
    out.push(v >> 8, v & 255);
  }
  return out;
}

const privateV4 = (a: number, b: number) =>
  a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
  (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;

/** True for loopback, private, link-local, CGNAT, multicast, NAT64, 6to4, IPv4-mapped/compatible and other non-public addresses. */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return privateV4(a, b);
  }
  if (net.isIPv6(ip)) {
    const by = ipv6Bytes(ip);
    if (!by) return true;
    const zeros = (n: number) => by.slice(0, n).every((x) => x === 0);
    // ::, ::1, IPv4-compatible (::a.b.c.d) and IPv4-mapped (::ffff:a.b.c.d): judge by the embedded IPv4 address
    if (zeros(10) && ((by[10] === 0 && by[11] === 0) || (by[10] === 255 && by[11] === 255))) return privateV4(by[12], by[13]);
    // NAT64 64:ff9b::/96 and 6to4 2002::/16 embed an IPv4 address: refuse the whole ranges
    if (by[0] === 0x00 && by[1] === 0x64 && by[2] === 0xff && by[3] === 0x9b) return true;
    if (by[0] === 0x20 && by[1] === 0x02) return true;
    if (by[0] === 0x20 && by[1] === 0x01 && by[2] === 0x0d && by[3] === 0xb8) return true; // documentation
    if ((by[0] & 0xfe) === 0xfc) return true; // fc00::/7 unique local
    if (by[0] === 0xfe && (by[1] & 0xc0) === 0x80) return true; // fe80::/10 link-local
    if (by[0] === 0xff) return true; // multicast
    if (by[0] === 0x01 && by[1] === 0x00 && by.slice(2, 8).every((x) => x === 0)) return true; // 100::/64 discard
    return false;
  }
  return true;
}

const blockedName = (h: string) => {
  const l = h.toLowerCase();
  return l === "localhost" || l.endsWith(".localhost") || l.endsWith(".internal") || l.endsWith(".local") || l.endsWith(".localdomain");
};

/** Resolves the host and refuses anything that is not a public http(s) address. Returns the URL and the vetted addresses. */
async function vet(raw: string): Promise<{ url: URL; addresses: Array<{ address: string; family: number }> }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only http(s) URLs are allowed");
  if (url.username || url.password) throw new Error("URLs with credentials are not allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (blockedName(host)) throw new Error("URL points to a non-public address");
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("URL points to a non-public address");
    return { url, addresses: [{ address: host, family: net.isIP(host) }] };
  }
  const records = await dns.lookup(host, { all: true }).catch(() => []);
  if (!records.length) throw new Error("URL host could not be resolved");
  if (records.some((r) => isPrivateIp(r.address))) throw new Error("URL points to a non-public address");
  return { url, addresses: records };
}

/** Validates a user-supplied URL (use `safeFetch` to actually request it). */
export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  return (await vet(raw)).url;
}

/**
 * fetch() for a user-supplied URL: the connection is PINNED to the address that was checked (no DNS-rebinding window),
 * redirects are never followed, and the caller can cap the body with `readLimited`.
 */
export async function safeFetch(raw: string, init: { method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number } = {}): Promise<Response> {
  const { url, addresses } = await vet(raw);
  const pinned = addresses[0];
  const agent = new Agent({
    connect: {
      lookup: (_host: string, opts: any, cb: any) => {
        if (opts && opts.all) cb(null, [{ address: pinned.address, family: pinned.family }]);
        else cb(null, pinned.address, pinned.family);
      },
    },
  });
  try {
    const res = await undiciFetch(url.toString(), {
      method: init.method || "GET",
      headers: init.headers,
      body: init.body,
      redirect: "manual",
      dispatcher: agent,
      signal: AbortSignal.timeout(init.timeoutMs ?? 10000),
    } as any);
    return res as unknown as Response;
  } finally {
    // the body may still be streaming: close the agent once it is done
    setTimeout(() => void agent.close().catch(() => undefined), (init.timeoutMs ?? 10000) + 1000).unref?.();
  }
}

/** Reads at most `maxBytes` of a response body as text (the rest is dropped). */
export async function readLimited(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    total += value.length;
    chunks.push(value.length + (total - value.length) > maxBytes ? value.subarray(0, maxBytes - (total - value.length)) : value);
    if (total >= maxBytes) {
      await reader.cancel().catch(() => undefined);
      break;
    }
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}
