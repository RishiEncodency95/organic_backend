import { describe, expect, it, vi } from 'vitest';
import { instagramStats, socialProfiles, youtubeStats } from '../../src/modules/competitor-analyzer/analyzer-social';

const reply = (status: number, body: unknown) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response);

describe('social profiles from links', () => {
  it('keeps one profile per platform with its handle and skips share buttons and single posts', () => {
    const list = socialProfiles([
      'https://www.facebook.com/sharer/sharer.php?u=https://x.test',
      'https://www.facebook.com/BharatOrganicExpo/',
      'https://www.instagram.com/p/C1234/',
      'https://www.instagram.com/bharatorganicexpo/',
      'https://www.youtube.com/@BharatOrganic',
      'https://www.youtube.com/watch?v=abc',
      'https://www.linkedin.com/company/bharat-organic/',
      'https://twitter.com/intent/tweet?text=hi',
      'https://x.com/bharatorganic',
      'https://wa.me/919876543210',
    ]);
    expect(list.map((p) => [p.platform, p.handle])).toEqual([
      ['youtube', '@BharatOrganic'],
      ['instagram', 'bharatorganicexpo'],
      ['facebook', 'BharatOrganicExpo'],
      ['linkedin', 'company/bharat-organic'],
      ['x', 'bharatorganic'],
      ['whatsapp', null],
    ]);
  });

  it('reads the page name from facebook.com/people/… and /pages/… links', () => {
    expect(socialProfiles(['https://www.facebook.com/people/Annapoorna-Inter-Food/100063552741/'])[0]).toMatchObject({ platform: 'facebook', handle: 'Annapoorna-Inter-Food' });
    expect(socialProfiles(['https://www.facebook.com/pages/Bharat%20Expo/123'])[0]?.handle).toBe('Bharat Expo');
    expect(socialProfiles(['https://www.facebook.com/people/'])).toEqual([]);
  });
});

describe('YouTube numbers', () => {
  const profile = { platform: 'youtube' as const, url: 'https://www.youtube.com/@Expo', handle: '@Expo' };

  it('reads public channel numbers and the newest upload', async () => {
    const fetcher = vi.fn((url: string) =>
      url.includes('/channels?')
        ? reply(200, { items: [{ id: 'UC1', snippet: { title: 'Expo TV' }, statistics: { subscriberCount: '1200', videoCount: '45', viewCount: '98000' }, contentDetails: { relatedPlaylists: { uploads: 'UU1' } } }] })
        : reply(200, { items: [{ contentDetails: { videoPublishedAt: '2026-10-01T10:00:00Z' } }] }),
    );
    const stats = await youtubeStats(profile, 'key', fetcher as never);
    expect(stats).toMatchObject({ status: 'ok', title: 'Expo TV', subscribers: 1200, videos: 45, views: 98000, lastUploadAt: '2026-10-01T10:00:00Z' });
    expect(String(fetcher.mock.calls[0]![0])).toContain('forHandle=%40Expo');
  });

  it('keeps a hidden subscriber count hidden and explains what cannot be looked up', async () => {
    const hidden = await youtubeStats(profile, 'key', (() => reply(200, { items: [{ id: 'UC1', snippet: { title: 'T' }, statistics: { hiddenSubscriberCount: true, videoCount: '2', viewCount: '10' } }] })) as never);
    expect(hidden).toMatchObject({ status: 'ok', subscribers: null });
    expect((await youtubeStats({ ...profile, handle: 'c/OldName' }, 'key')).status).toBe('unresolved');
    expect((await youtubeStats(profile, null)).status).toBe('unavailable');
    expect((await youtubeStats(profile, 'key', (() => reply(200, { items: [] })) as never)).status).toBe('not_found');
  });
});

describe('Instagram numbers', () => {
  const profile = { platform: 'instagram' as const, url: 'https://instagram.com/expo', handle: 'expo' };
  const viewer = { igUserId: '1789', token: 'tok', appSecret: 'secret', version: 'v21.0' };

  it('reads a professional account through Business Discovery', async () => {
    const fetcher = vi.fn(() => reply(200, { business_discovery: { username: 'expo', name: 'Expo', followers_count: 5400, media_count: 320, media: { data: [{ timestamp: '2026-10-20T09:00:00+0000' }] } } }));
    const stats = await instagramStats(profile, viewer, fetcher as never);
    expect(stats).toMatchObject({ status: 'ok', followers: 5400, posts: 320, lastPostAt: '2026-10-20T09:00:00+0000' });
    expect(String((fetcher.mock.calls[0] as unknown as [string])[0])).toContain('appsecret_proof=');
  });

  it('says why there is no number instead of guessing', async () => {
    expect((await instagramStats(profile, null)).status).toBe('unavailable');
    const personal = await instagramStats(profile, viewer, (() => reply(400, { error: { message: 'Invalid user id' } })) as never);
    expect(personal.status).toBe('not_found');
    expect((await instagramStats({ ...profile, handle: 'bad name!' }, viewer)).status).toBe('not_found');
  });
});
