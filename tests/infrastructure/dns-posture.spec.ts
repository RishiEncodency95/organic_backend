import { describe, expect, it } from 'vitest';
import { EMPTY_RECORDS, diffRecords, emailPosture, redactForViewer, type DnsRecords } from '../../src/modules/infrastructure/core/dns-intel';

const rec = (o: Partial<DnsRecords>): DnsRecords => ({ ...EMPTY_RECORDS, ...o });

describe('email / DNS configuration posture', () => {
  it('reads SPF qualifier, DMARC policy and CAA presence without scoring them', () => {
    const p = emailPosture(rec({
      TXT: ['v=spf1 include:_spf.example.net -all'],
      DMARC: ['v=DMARC1; p=quarantine; rua=mailto:reports@example.com'],
      CAA: [{ critical: 0, tag: 'issue', value: 'letsencrypt.org' }],
      MX: [{ priority: 10, exchange: 'mx.example.com' }],
    }));
    expect(p.spf).toEqual({ present: true, qualifier: 'fail' });
    expect(p.dmarc).toEqual({ present: true, policy: 'quarantine' });
    expect(p.caa).toEqual({ present: true, issuers: 1 });
    expect(p.mx.present).toBe(true);
    expect(p.dkim.checked).toBe(false);
  });
  it('reports "not found" neutrally, and unknown DMARC for snapshots that predate the check', () => {
    expect(emailPosture(rec({})).spf).toEqual({ present: false, qualifier: 'none' });
    expect(emailPosture(rec({})).dmarc).toEqual({ present: false, policy: null });
    const old = { ...EMPTY_RECORDS } as Partial<DnsRecords>;
    delete old.DMARC;
    expect(emailPosture(old as DnsRecords).dmarc.present).toBeNull();
  });
  it('does not treat the first appearance of DMARC data as a DNS change', () => {
    const before = { ...EMPTY_RECORDS, A: ['1.1.1.1'] } as Partial<DnsRecords>;
    delete before.DMARC;
    const after = rec({ A: ['1.1.1.1'], DMARC: ['v=DMARC1; p=none'] });
    expect(diffRecords(before as DnsRecords, after)).toEqual([]);
    const changed = diffRecords(rec({ DMARC: ['v=DMARC1; p=none'] }), rec({ DMARC: ['v=DMARC1; p=reject'] }));
    expect(changed.map((c) => c.type)).toEqual(['DMARC']);
  });
  it('hides DMARC contents (report addresses) from viewers without sensitive access', () => {
    const r = redactForViewer(rec({ DMARC: ['v=DMARC1; p=reject; rua=mailto:secret@example.com'] }), false);
    expect(JSON.stringify(r)).not.toContain('secret@example.com');
  });
});
