import * as tls from 'node:tls';
import { isIP } from 'node:net';
import { resolvePublicAddress, type SafeFetchDeps } from './safe-fetch';
import { daysBetween } from './billing-math';

export const SSL_ALLOWED_PORTS: readonly number[] = [443, 8443];
export const SSL_EXPIRING_DAYS = 30;

export type SslState = 'VALID' | 'EXPIRING' | 'EXPIRED' | 'UNKNOWN';

export interface CertificateInfo {
  commonName: string | null;
  sans: string[];
  issuer: string | null;
  validFrom: Date | null;
  validTo: Date | null;
  fingerprint: string | null;
}

export interface SslProbeResult {
  ok: boolean;
  certificate: CertificateInfo | null;
  trusted: boolean | null;
  verifyError: string | null;
  error: string | null;
}

export function certificateState(validTo: Date | null, now: Date, expiringDays = SSL_EXPIRING_DAYS): { state: SslState; daysRemaining: number | null } {
  if (!validTo) return { state: 'UNKNOWN', daysRemaining: null };
  const daysRemaining = daysBetween(now, validTo);
  if (validTo.getTime() <= now.getTime()) return { state: 'EXPIRED', daysRemaining };
  return { state: daysRemaining <= expiringDays ? 'EXPIRING' : 'VALID', daysRemaining };
}

export function parsePeerCertificate(cert: Partial<tls.PeerCertificate> | null | undefined): CertificateInfo {
  if (!cert || !Object.keys(cert).length) return { commonName: null, sans: [], issuer: null, validFrom: null, validTo: null, fingerprint: null };
  const sans = String(cert.subjectaltname ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.toUpperCase().startsWith('DNS:'))
    .map((s) => s.slice(4).toLowerCase());
  const date = (v?: string) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const issuer = cert.issuer ? [cert.issuer.O, cert.issuer.CN].filter(Boolean).join(' / ') : '';
  return {
    commonName: typeof cert.subject?.CN === 'string' ? cert.subject.CN.toLowerCase() : null,
    sans: [...new Set(sans)].slice(0, 100),
    issuer: issuer ? issuer.slice(0, 300) : null,
    validFrom: date(cert.valid_from),
    validTo: date(cert.valid_to),
    fingerprint: cert.fingerprint256 ?? null,
  };
}

export function assertProbeTarget(hostname: string, port: number): void {
  if (!SSL_ALLOWED_PORTS.includes(port)) throw new Error(`Port ${port} cannot be inspected.`);
  if (isIP(hostname)) throw new Error('Certificates are inspected by hostname, not IP address.');
}
export async function probeCertificate(hostname: string, port = 443, deps: SafeFetchDeps = {}, timeoutMs = 8000): Promise<SslProbeResult> {
  try {
    assertProbeTarget(hostname, port);
    const address = await resolvePublicAddress(hostname, deps);
    return await new Promise<SslProbeResult>((resolve) => {
      let settled = false;
      const done = (r: SslProbeResult) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(r);
      };
      const socket = tls.connect({ host: address, port, servername: hostname, rejectUnauthorized: false, timeout: timeoutMs, ALPNProtocols: ['http/1.1'] }, () => {
        const cert = socket.getPeerCertificate(false);
        const info = parsePeerCertificate(cert);
        done({
          ok: Boolean(info.validTo),
          certificate: info,
          trusted: socket.authorized,
          verifyError: socket.authorized ? null : String(socket.authorizationError ?? 'unverified').slice(0, 200),
          error: info.validTo ? null : 'The server did not present a certificate.',
        });
      });
      socket.on('timeout', () => done({ ok: false, certificate: null, trusted: null, verifyError: null, error: `TLS handshake timed out after ${timeoutMs}ms.` }));
      socket.on('error', (e) => done({ ok: false, certificate: null, trusted: null, verifyError: null, error: `TLS connection failed: ${(e as NodeJS.ErrnoException).code ?? e.message}`.slice(0, 300) }));
    });
  } catch (e) {
    return { ok: false, certificate: null, trusted: null, verifyError: null, error: (e instanceof Error ? e.message : 'Probe failed').slice(0, 300) };
  }
}
