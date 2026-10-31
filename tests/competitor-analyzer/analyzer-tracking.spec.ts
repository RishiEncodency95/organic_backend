import { describe, expect, it } from 'vitest';
import { sitemapActivity, sitemapLocs } from '../../src/modules/competitor-analyzer/analyzer-evidence';
import { actionKey, changesEmail, nextCheckAt, nextReportAt, readActions, readSettings, reportEmail, validEmail } from '../../src/modules/competitor-analyzer/analyzer-tracking';

describe('settings', () => {
  it('normalises schedule, flags and e-mails (valid, unique, lower case, at most five)', () => {
    expect(readSettings(null)).toEqual({ schedule: 'off', alerts: false, reportEmails: [], reportMonthly: false });
    const s = readSettings({ schedule: 'weekly', alerts: true, reportMonthly: 'yes', reportEmails: ['A@x.in', 'a@x.in', 'bad', 'b@y.com', 'c@y.com', 'd@y.com', 'e@y.com', 'f@y.com'] });
    expect(s).toEqual({ schedule: 'weekly', alerts: true, reportMonthly: false, reportEmails: ['a@x.in', 'b@y.com', 'c@y.com', 'd@y.com', 'e@y.com'] });
    expect(readSettings({ schedule: 'hourly' }).schedule).toBe('off');
    expect(validEmail('owner@bharatorganicexpo.com')).toBe(true);
    expect(validEmail('nope@')).toBe(false);
  });

  it('schedules checks 7 or 30 days on at 09:00 India time, and the monthly report on the 1st', () => {
    const from = new Date('2026-10-22T12:00:00Z');
    expect(nextCheckAt('off', from)).toBeNull();
    expect(nextCheckAt('weekly', from)?.toISOString()).toBe('2026-10-29T03:30:00.000Z');
    expect(nextCheckAt('monthly', from)?.toISOString()).toBe('2026-11-21T03:30:00.000Z');
    expect(nextReportAt(from).toISOString()).toBe('2026-11-01T03:30:00.000Z');
    expect(nextReportAt(new Date('2026-12-15T00:00:00Z')).toISOString()).toBe('2027-01-01T03:30:00.000Z');
  });
});

describe('action progress', () => {
  it('keys an action by its wording, ignoring case and spacing', () => {
    expect(actionKey('Add visitor  numbers')).toBe(actionKey('add visitor numbers '));
    expect(actionKey('Add visitor numbers')).toMatch(/^[a-f0-9]{16}$/);
  });

  it('reads only well-formed entries', () => {
    const key = actionKey('Start a blog');
    expect(readActions({ [key]: { status: 'done', action: 'Start a blog', taskId: 't1', updatedAt: 'x' }, bad: { status: 'done' }, [actionKey('x')]: { status: 'weird' } })).toEqual({
      [key]: { status: 'done', action: 'Start a blog', taskId: 't1', updatedAt: 'x', updatedBy: null },
      [actionKey('x')]: { status: 'todo', action: '', taskId: null, updatedAt: '', updatedBy: null },
    });
  });
});

describe('e-mails', () => {
  it('lists the changes and escapes site text', () => {
    const mail = changesEmail({ studyName: 'Expo <2026>', changes: [{ domain: 'a.com', kind: 'title', direction: 'neutral', text: 'Title changed to "<b>New</b>"' }], link: 'https://app.example/x' });
    expect(mail.subject).toBe('1 change on your competitors - Expo <2026>');
    expect(mail.html).toContain('&lt;b&gt;New&lt;/b&gt;');
    expect(mail.html).not.toContain('<b>New</b>');
    expect(mail.text).toContain('a.com: Title changed');
  });

  it('summarises the report with score and rank', () => {
    const mail = reportEmail({ studyName: 'S', ownDomain: 'mine.in', headline: 'You lead.', score: 80, rank: 1, total: 5, link: null });
    expect(mail.html).toContain('80/100');
    expect(mail.text).toContain('rank #1 of 5');
  });
});

describe('sitemap activity', () => {
  const xml = `<urlset>
    <url><loc>https://x.in/</loc><lastmod>2026-10-20</lastmod></url>
    <url><loc>https://x.in/blog/new</loc><lastmod>2026-10-15T10:00:00+05:30</lastmod></url>
    <url><loc>https://x.in/about</loc><lastmod>2026-08-01</lastmod></url>
    <url><loc>https://x.in/old</loc><lastmod>2025-01-01</lastmod></url>
    <url><loc>https://x.in/brochure.pdf</loc><lastmod>2026-10-21</lastmod></url>
    <url><loc>https://other.com/page</loc><lastmod>2026-10-21</lastmod></url>
  </urlset>`;

  it('counts recently updated pages and picks the newest content pages', () => {
    const { entries } = sitemapLocs(xml);
    const a = sitemapActivity(entries, 'x.in', new Date('2026-10-22T00:00:00Z'));
    expect(a.recent30).toBe(4);
    expect(a.recent90).toBe(5);
    expect(a.latest).toBe('2026-10-21');
    expect(a.newest).toEqual(['https://x.in/blog/new', 'https://x.in/about', 'https://x.in/old']);
  });

  it('reports unknown activity when the sitemap has no dates', () => {
    const a = sitemapActivity(sitemapLocs('<urlset><url><loc>https://x.in/a</loc></url></urlset>').entries, 'x.in');
    expect(a).toEqual({ recent30: null, recent90: null, latest: null, newest: ['https://x.in/a'] });
  });
});
