import { domainToASCII, domainToUnicode } from 'node:url';
import { isIP } from 'node:net';

export interface NormalizedDomain {
  ascii: string;
  unicode: string;
  tld: string;
}

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const RESERVED_TLDS = ['localhost', 'local', 'internal', 'invalid', 'test', 'example', 'onion', 'lan', 'home', 'corp', 'intranet'];

export function normalizeDomain(input: string): { ok: true; value: NormalizedDomain } | { ok: false; reason: string } {
  let raw = (input ?? '').trim().toLowerCase();
  if (!raw) return { ok: false, reason: 'Enter a domain name.' };
  if (/^[a-z][a-z0-9+.-]*:\/\//.test(raw)) {
    try { raw = new URL(raw).hostname; } catch { return { ok: false, reason: 'That is not a valid domain name.' }; }
  }
  raw = raw.replace(/\.$/, '');
  if (/[\s/@:?#\\]/.test(raw)) return { ok: false, reason: 'Enter only the domain name, without paths, ports or credentials.' };
  if (isIP(raw) || /^\d+(\.\d+)*$/.test(raw)) return { ok: false, reason: 'IP addresses are not domain names.' };
  if (raw.includes('*')) return { ok: false, reason: 'Wildcard names are not supported.' };
  const ascii = domainToASCII(raw);
  if (!ascii) return { ok: false, reason: 'That is not a valid domain name.' };
  if (ascii.length > 253) return { ok: false, reason: 'A domain name can be at most 253 characters.' };
  const labels = ascii.split('.');
  if (labels.length < 2) return { ok: false, reason: 'Enter a full domain such as example.com.' };
  if (!labels.every((l) => LABEL.test(l))) return { ok: false, reason: 'The domain contains invalid characters.' };
  const tld = labels[labels.length - 1];
  if (/^\d+$/.test(tld)) return { ok: false, reason: 'The top-level domain cannot be numeric.' };
  if (RESERVED_TLDS.includes(tld)) return { ok: false, reason: 'Reserved or private top-level domains cannot be monitored.' };
  return { ok: true, value: { ascii, unicode: domainToUnicode(ascii) || ascii, tld } };
}
