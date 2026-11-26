import { resolveGscAccessToken } from '../seoAudit/gsc.service';
import { searchConsoleReport, type SearchPeriod } from '../website-intelligence/search-console-report';
import { getTransporter } from '../../services/email.service';
import { ServiceUnavailableException } from './errors';
import type { SafeFetchDeps } from '../website-intelligence/safe-fetch';
import { currentMessageId } from './delivery-context';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const ORGANISATION_ID = 'organic-bharat';
export type TenantContext = { companyId: string; userId: string; clientId?: string };
export const networkDeps = (): SafeFetchDeps => {
  // Hermetic subprocess tests only; never permits loopback in development or production.
  if (process.env.NODE_ENV === 'test' && process.env.COMPETITOR_TEST_HTTP_PORT) return {
    resolve: async host => { if (!host.endsWith('.fixture.test')) throw new Error('External network disabled in worker fixture'); return ['127.0.0.1']; },
    isBlocked: address => address !== '127.0.0.1',
  };
  return {};
};
export const organisation = () => ({ name: process.env.COMPETITOR_ORGANISATION_NAME ?? 'Bharat Organic Expo',
  reportLogoAsset: process.env.COMPETITOR_REPORT_LOGO_URL ? {secureUrl:process.env.COMPETITOR_REPORT_LOGO_URL,format:'png'} : null, logoAsset: null });
export async function localReportLogo():Promise<Buffer|null> {
  for(const path of [resolve(__dirname,'../../../assets/email-logo.png'),resolve(__dirname,'../../../../assets/email-logo.png'),resolve(process.cwd(),'assets/email-logo.png')]) {
    const bytes=await readFile(path).catch(()=>null);
    if(bytes && bytes.length<3_000_000 && (bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || (bytes[0]===255&&bytes[1]===216)))return bytes;
  }
  return null;
}
export const emailAdapter = {
  async send(options: { companyId: string; to: string; subject: string; html: string; text?: string; attachments?: { filename: string; content: Buffer; contentType: string }[] }) {
    const transport = getTransporter();
    if (!transport) throw new ServiceUnavailableException({ message: 'SMTP is not configured.', reason: 'email_unavailable' });
    const { companyId: _companyId, ...mail } = options;
    const deadline=setTimeout(()=>transport.close(),30_000);
    try { await transport.sendMail({ from: process.env.FROM_EMAIL ?? process.env.SMTP_USER, messageId:currentMessageId(options.to), ...mail }); }
    finally { clearTimeout(deadline);transport.close(); }
  },
};
export async function loadSearchConsoleReport(property: string, period: SearchPeriod) {
  const token = await resolveGscAccessToken().catch(()=>null);
  if (!token) return { ok: false as const };
  return searchConsoleReport({ property, period, token });
}
