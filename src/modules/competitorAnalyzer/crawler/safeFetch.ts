import { promises as dns } from "node:dns";
import * as http from "node:http";
import * as https from "node:https";
import { BlockList, isIP } from "node:net";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import { FetchBlockedError } from "../errors";

/*
 * SSRF-safe HTTP GET for untrusted public websites (adapted from the OmniPlatform reference safe-fetch).
 *  - http/https only, no credentials in the URL, ports 80/443 only (unless a test dependency allows others)
 *  - every hop (including each redirect) is DNS-resolved; ANY private / loopback / link-local / metadata / reserved
 *    address in the answer refuses the request
 *  - the socket is pinned to the validated address (no second DNS lookup → DNS rebinding cannot swap the target)
 *  - decoded body size, time and redirect count are bounded; only GET/HEAD; nothing is ever POSTed
 * Network-level egress controls should still be applied in production (DEPLOYMENT.md).
 */

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  ["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8], ["64:ff9b::", 96],
  ["64:ff9b:1::", 48], ["100::", 64], ["2001:db8::", 32], ["2001::", 32], ["2002::", 16],
] as const) blocked.addSubnet(net, prefix, "ipv6");

/** True for any address that must never be fetched (unparseable addresses are refused too). */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (!version) return true;
  if (version === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (mapped) return isPrivateAddress(mapped[1]);
    const hexMapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(address);
    if (hexMapped) {
      const hi = parseInt(hexMapped[1], 16);
      const lo = parseInt(hexMapped[2], 16);
      return isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return blocked.check(address, "ipv6");
  }
  return blocked.check(address, "ipv4");
}

export interface SafeFetchOptions {
  method?: "GET" | "HEAD";
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  signal?: AbortSignal;
  responseType?: "text" | "binary";
}

export interface SafeFetchDeps {
  resolve?: (hostname: string) => Promise<string[]>;
  isBlocked?: (address: string) => boolean;
  /** Tests only: permit non-80/443 ports (fixture servers). */
  allowAnyPort?: boolean;
}

export interface SafeFetchResult {
  ok: boolean;
  status: number;
  url: string;
  requestedUrl: string;
  redirected: boolean;
  redirectChain: { url: string; status: number }[];
  headers: Record<string, string>;
  contentType: string;
  body: string;
  bodyBytes?: Buffer;
  truncated: boolean;
  elapsedMs: number;
}

export const DEFAULT_MAX_BYTES = 2_000_000;
export const DEFAULT_TIMEOUT_MS = 12_000;

async function defaultResolve(hostname: string): Promise<string[]> {
  const rows = await dns.lookup(hostname, { all: true, verbatim: true });
  return rows.map((row) => row.address);
}

export function assertSafeUrl(raw: string | URL, deps: SafeFetchDeps = {}): URL {
  let url: URL;
  try {
    url = typeof raw === "string" ? new URL(raw) : new URL(raw.href);
  } catch {
    throw new FetchBlockedError("INVALID_URL", "Invalid URL.");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new FetchBlockedError("INVALID_URL", "Only HTTP and HTTPS URLs can be fetched.");
  if (url.username || url.password) throw new FetchBlockedError("INVALID_URL", "URLs with embedded credentials are not allowed.");
  if (!url.hostname) throw new FetchBlockedError("INVALID_URL", "URL has no host.");
  if (!deps.allowAnyPort && url.port && !["80", "443"].includes(url.port)) {
    throw new FetchBlockedError("BLOCKED_TARGET", "Only standard web ports (80/443) can be fetched.");
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "metadata.google.internal" || host.endsWith(".internal")) {
    throw new FetchBlockedError("BLOCKED_TARGET", "Local or internal hosts cannot be fetched.");
  }
  return url;
}

/** Resolves `hostname`, refusing when ANY returned address is not public. Returns the address to pin. */
export async function resolvePublicAddress(hostname: string, deps: SafeFetchDeps = {}): Promise<string> {
  const host = hostname.replace(/^\[|\]$/g, "");
  const check = deps.isBlocked ?? isPrivateAddress;
  const addresses = isIP(host) ? [host] : await (deps.resolve ?? defaultResolve)(host).catch(() => [] as string[]);
  if (!addresses.length) throw new FetchBlockedError("BLOCKED_TARGET", `Could not resolve ${hostname}.`);
  if (addresses.some((address) => check(address))) throw new FetchBlockedError("BLOCKED_TARGET", "Private, local or reserved network addresses cannot be fetched.");
  return addresses[0];
}

function singleRequest(url: URL, address: string, options: SafeFetchOptions) {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const client = url.protocol === "https:" ? https : http;
  return new Promise<{ status: number; headers: Record<string, string>; body: string; bodyBytes?: Buffer; truncated: boolean }>((resolve, reject) => {
    const family = isIP(address);
    let settled = false;
    const done = (fn: () => void) => {
      if (!settled) {
        settled = true;
        clearTimeout(overall);
        options.signal?.removeEventListener("abort", onAbort);
        fn();
      }
    };
    const request = client.request(
      url,
      {
        method: options.method ?? "GET",
        headers: {
          "accept-encoding": "gzip, deflate, br",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
          ...options.headers,
        },
        // Pin the socket to the validated address; answer in the shape Node asks for (all:true → array).
        lookup: ((_host: string, opts: unknown, maybeCb?: unknown) => {
          const cb = (typeof opts === "function" ? opts : maybeCb) as (err: Error | null, address: unknown, family?: number) => void;
          const wantsAll = typeof opts === "object" && opts !== null && (opts as { all?: boolean }).all === true;
          if (wantsAll) cb(null, [{ address, family }]);
          else cb(null, address, family);
        }) as never,
        timeout: timeoutMs,
      },
      (response) => {
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(response.headers)) {
          if (Array.isArray(value)) headers[key] = value.join(", ");
          else if (value !== undefined) headers[key] = String(value);
        }
        const encoding = String(response.headers["content-encoding"] ?? "").toLowerCase();
        const stream =
          encoding === "gzip" ? response.pipe(createGunzip()) : encoding === "deflate" ? response.pipe(createInflate()) : encoding === "br" ? response.pipe(createBrotliDecompress()) : response;
        const chunks: Buffer[] = [];
        let received = 0;
        let truncated = false;
        const finish = () => done(() => {
          const bytes = Buffer.concat(chunks);
          resolve({ status: response.statusCode ?? 0, headers, body: options.responseType === "binary" ? "" : bytes.toString("utf8"), ...(options.responseType === "binary" ? { bodyBytes: bytes } : {}), truncated });
        });
        // Limits apply to DECODED bytes so a small compressed bomb is cut off too.
        stream.on("data", (chunk: Buffer) => {
          if (truncated) return;
          received += chunk.length;
          if (received > maxBytes) {
            truncated = true;
            chunks.push(chunk.subarray(0, chunk.length - (received - maxBytes)));
            response.destroy();
            stream.destroy();
            finish();
            return;
          }
          chunks.push(chunk);
        });
        stream.on("end", () => {
          if (!truncated) finish();
        });
        stream.on("error", (error: Error) => {
          if (!truncated) done(() => reject(error));
        });
      },
    );
    // Socket idle timeout plus an overall wall-clock cap (slow-drip responses).
    const overall = setTimeout(() => request.destroy(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs + 1_000);
    const onAbort = () => request.destroy(new Error("Request cancelled"));
    options.signal?.addEventListener("abort", onAbort);
    request.on("timeout", () => request.destroy(new Error(`Request timed out after ${timeoutMs}ms`)));
    request.on("error", (error) => done(() => reject(error)));
    request.end();
  });
}

/** Fetches `raw` with GET/HEAD, validating the target and every redirect hop. */
export async function safeFetch(raw: string | URL, options: SafeFetchOptions = {}, deps: SafeFetchDeps = {}): Promise<SafeFetchResult> {
  const started = Date.now();
  const maxRedirects = options.maxRedirects ?? 5;
  let current = assertSafeUrl(raw, deps);
  const requestedUrl = current.href;
  const redirectChain: { url: string; status: number }[] = [];
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    if (options.signal?.aborted) throw new Error("Request cancelled");
    const address = await resolvePublicAddress(current.hostname, deps);
    const result = await singleRequest(current, address, options);
    const location = result.headers["location"];
    if (result.status >= 300 && result.status < 400 && location) {
      redirectChain.push({ url: current.href, status: result.status });
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        throw new FetchBlockedError("INVALID_URL", "Redirect target is not a valid URL.");
      }
      current = assertSafeUrl(next, deps);
      continue;
    }
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      url: current.href,
      requestedUrl,
      redirected: redirectChain.length > 0,
      redirectChain,
      headers: result.headers,
      contentType: (result.headers["content-type"] || "").toLowerCase(),
      body: result.body,
      ...(result.bodyBytes ? { bodyBytes: result.bodyBytes } : {}),
      truncated: result.truncated,
      elapsedMs: Date.now() - started,
    };
  }
  throw new FetchBlockedError("BLOCKED_TARGET", `Too many redirects (>${maxRedirects}).`);
}

export type Fetcher = (url: string, options?: SafeFetchOptions) => Promise<SafeFetchResult>;

export const makeSafeFetcher = (deps: SafeFetchDeps = {}): Fetcher => (url, options) => safeFetch(url, options, deps);
