/** Thrown when a URL or address is refused (private range, bad scheme, redirect loop...). */
export class UnsafeFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeFetchError';
  }
}
import { promises as dns } from 'node:dns';
import * as http from 'node:http';
import * as https from 'node:https';
import { BlockList, isIP } from 'node:net';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
const blocked = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['64:ff9b::', 96], ['100::', 64], ['2001:db8::', 32]] as const) {
  blocked.addSubnet(net, prefix, 'ipv6');
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (!version) return true;
  if (version === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (mapped) return isPrivateAddress(mapped[1]);
    return blocked.check(address, 'ipv6');
  }
  return blocked.check(address, 'ipv4');
}

export interface SafeFetchOptions {
  method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

export interface SafeFetchDeps {
  resolve?: (hostname: string) => Promise<string[]>;
  isBlocked?: (address: string) => boolean;
}

export interface SafeFetchResult {
  ok: boolean;
  status: number;
  url: string;
  requestedUrl: string;
  redirected: boolean;
  redirectChain: { url: string; status: number }[];
  headers: Headers;
  body: string;
  truncated: boolean;
  elapsedMs: number;
}

const DEFAULT_MAX_BYTES = 2_000_000;
const DEFAULT_TIMEOUT_MS = 12_000;

async function defaultResolve(hostname: string): Promise<string[]> {
  const rows = await dns.lookup(hostname, { all: true, verbatim: true });
  return rows.map((row) => row.address);
}

export function assertSafeUrl(raw: string | URL): URL {
  let url: URL;
  try { url = typeof raw === 'string' ? new URL(raw) : new URL(raw.href); } catch { throw new UnsafeFetchError('Invalid URL.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new UnsafeFetchError('Only HTTP and HTTPS URLs can be fetched.');
  if (url.username || url.password) throw new UnsafeFetchError('URLs with embedded credentials are not allowed.');
  if (!url.hostname) throw new UnsafeFetchError('URL has no host.');
  return url;
}

export async function resolvePublicAddress(hostname: string, deps: SafeFetchDeps = {}): Promise<string> {
  const host = hostname.replace(/^\[|\]$/g, '');
  const check = deps.isBlocked ?? isPrivateAddress;
  const addresses = isIP(host) ? [host] : await (deps.resolve ?? defaultResolve)(host).catch(() => []);
  if (!addresses.length) throw new UnsafeFetchError(`Could not resolve ${hostname}.`);
  if (addresses.some((address) => check(address))) throw new UnsafeFetchError('Private or local website addresses cannot be scanned.');
  return addresses[0];
}

function singleRequest(url: URL, address: string, options: SafeFetchOptions) {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const client = url.protocol === 'https:' ? https : http;
  return new Promise<{ status: number; headers: Headers; body: string; truncated: boolean }>((resolve, reject) => {
    const family = isIP(address);
    const request = client.request(
      url,
      {
        method: options.method ?? 'GET',
        headers: {
          'accept-encoding': 'gzip, deflate, br', accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5',
          ...(options.body !== undefined ? { 'content-length': String(Buffer.byteLength(options.body)) } : {}),
          ...options.headers,
        },
        lookup: ((_host: string, opts: unknown, maybeCb?: unknown) => {
          const cb = (typeof opts === 'function' ? opts : maybeCb) as (err: Error | null, address: unknown, family?: number) => void;
          const wantsAll = typeof opts === 'object' && opts !== null && (opts as { all?: boolean }).all === true;
          if (wantsAll) cb(null, [{ address, family }]);
          else cb(null, address, family);
        }) as never,
        timeout: timeoutMs,
      },
      (response) => {
        const headers = new Headers();
        for (const [key, value] of Object.entries(response.headers)) {
          if (Array.isArray(value)) value.forEach((entry) => headers.append(key, entry));
          else if (value !== undefined) headers.set(key, value);
        }
        const encoding = String(response.headers['content-encoding'] ?? '').toLowerCase();
        const stream = encoding === 'gzip' ? response.pipe(createGunzip()) : encoding === 'deflate' ? response.pipe(createInflate()) : encoding === 'br' ? response.pipe(createBrotliDecompress()) : response;
        const chunks: Buffer[] = [];
        let received = 0;
        let truncated = false;
        const finish = () => resolve({ status: response.statusCode ?? 0, headers, body: Buffer.concat(chunks).toString('utf8'), truncated });
        stream.on('data', (chunk: Buffer) => {
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
        stream.on('end', () => { if (!truncated) finish(); });
        stream.on('error', (error: Error) => { if (!truncated) reject(error); });
      },
    );
    request.on('timeout', () => request.destroy(new Error(`Request timed out after ${timeoutMs}ms`)));
    request.on('error', reject);
    if (options.body !== undefined) request.write(options.body);
    request.end();
  });
}

export async function safeFetch(raw: string | URL, options: SafeFetchOptions = {}, deps: SafeFetchDeps = {}): Promise<SafeFetchResult> {
  const started = Date.now();
  const maxRedirects = options.maxRedirects ?? 5;
  const requestedUrl = assertSafeUrl(raw).href;
  const redirectChain: { url: string; status: number }[] = [];
  let current = assertSafeUrl(raw);
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const address = await resolvePublicAddress(current.hostname, deps);
    const result = await singleRequest(current, address, options);
    const location = result.headers.get('location');
    if (result.status >= 300 && result.status < 400 && location && ['GET', 'HEAD'].includes(options.method ?? 'GET')) {
      redirectChain.push({ url: current.href, status: result.status });
      let next: URL;
      try { next = new URL(location, current); } catch { throw new UnsafeFetchError('Redirect target is not a valid URL.'); }
      current = assertSafeUrl(next);
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
      body: result.body,
      truncated: result.truncated,
      elapsedMs: Date.now() - started,
    };
  }
  throw new UnsafeFetchError(`Too many redirects (>${maxRedirects}).`);
}
