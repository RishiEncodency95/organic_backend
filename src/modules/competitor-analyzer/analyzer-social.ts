/**
 * Social media of the compared websites: which profiles each site links to, and public numbers where an official API
 * gives them. YouTube numbers come from the YouTube Data API (API key). Instagram numbers come from Meta's Business
 * Discovery, through the company's own connected Instagram professional account. No platform is scraped; when a number
 * is not available the reason is stored instead.
 */

import { createHmac } from 'node:crypto';

export const SOCIAL_PLATFORMS = ['youtube', 'instagram', 'facebook', 'linkedin', 'x', 'pinterest', 'threads', 'tiktok', 'whatsapp', 'telegram'] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export interface SocialProfile {
  platform: SocialPlatform;
  url: string;
  /** @handle, channel id or page name taken from the link; null when the link does not name one. */
  handle: string | null;
}

export type YouTubeStats =
  | { status: 'ok'; channelId: string; title: string; subscribers: number | null; videos: number; views: number; lastUploadAt: string | null; url: string }
  | { status: 'unresolved' | 'not_found' | 'unavailable' | 'error'; message: string; url: string };

export type InstagramStats =
  | { status: 'ok'; username: string; name: string | null; followers: number; posts: number; lastPostAt: string | null; url: string }
  | { status: 'unavailable' | 'not_found' | 'error'; message: string; url: string };

export interface SiteSocials {
  profiles: SocialProfile[];
  youtube: YouTubeStats | null;
  instagram: InstagramStats | null;
  checkedAt: string;
}

const RESERVED = new Set(['share', 'sharer', 'sharer.php', 'intent', 'home', 'watch', 'embed', 'p', 'reel', 'reels', 'stories', 'explore', 'tr', 'dialog', 'plugins', 'login', 'hashtag', 'search', 'feed']);

/** One profile per platform from a site's links; share buttons, single posts and videos are skipped. */
export function socialProfiles(links: string[]): SocialProfile[] {
  const out = new Map<SocialPlatform, SocialProfile>();
  for (const raw of links) {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      continue;
    }
    const host = u.hostname.toLowerCase().replace(/^(www|m|mobile|web)\./, '');
    const parts = u.pathname.split('/').filter(Boolean);
    const first = decodeURIComponent(parts[0] ?? '');
    const pick = (platform: SocialPlatform, handle: string | null) => {
      if (!out.has(platform)) out.set(platform, { platform, url: u.href, handle });
    };
    if (host === 'youtube.com') {
      if (first === 'channel' && parts[1]) pick('youtube', parts[1]);
      else if (first.startsWith('@')) pick('youtube', first);
      else if ((first === 'user' || first === 'c') && parts[1]) pick('youtube', `${first}/${parts[1]}`);
    } else if (host === 'instagram.com') {
      if (first && !RESERVED.has(first.toLowerCase())) pick('instagram', first.replace(/^@/, ''));
    } else if (host === 'facebook.com' || host === 'fb.com') {
      if (first === 'profile.php' && u.searchParams.get('id')) pick('facebook', u.searchParams.get('id'));
      // facebook.com/people/Annapoorna-Inter-Food/100063… and /pages/Name/123: the name is the second part.
      else if ((first === 'people' || first === 'pages') && parts[1]) pick('facebook', decodeURIComponent(parts[1]));
      else if (first === 'people' || first === 'pages') continue;
      else if (first && !RESERVED.has(first.toLowerCase())) pick('facebook', first);
    } else if (host === 'linkedin.com') {
      if ((first === 'company' || first === 'in' || first === 'school') && parts[1]) pick('linkedin', `${first}/${parts[1]}`);
    } else if (host === 'twitter.com' || host === 'x.com') {
      if (first && !RESERVED.has(first.toLowerCase())) pick('x', first.replace(/^@/, ''));
    } else if (host === 'pinterest.com' || host.endsWith('.pinterest.com')) {
      if (first && !RESERVED.has(first.toLowerCase())) pick('pinterest', first);
    } else if (host === 'threads.net') {
      if (first.startsWith('@')) pick('threads', first);
    } else if (host === 'tiktok.com') {
      if (first.startsWith('@')) pick('tiktok', first);
    } else if (host === 'wa.me' || host === 'whatsapp.com' || host === 'api.whatsapp.com') {
      pick('whatsapp', null);
    } else if (host === 't.me') {
      if (first) pick('telegram', first);
    }
  }
  return SOCIAL_PLATFORMS.flatMap((p) => (out.has(p) ? [out.get(p)!] : []));
}

type Fetcher = typeof fetch;
const num = (v: unknown) => (typeof v === 'string' || typeof v === 'number') && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null;

async function getJson(fetcher: Fetcher, url: string, timeoutMs = 10_000): Promise<{ ok: boolean; status: number; body: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetcher(url, { signal: controller.signal });
    return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
  } finally {
    clearTimeout(timer);
  }
}

/** Public channel numbers for a YouTube link. Hidden subscriber counts stay null; /c/ links cannot be looked up by the API. */
export async function youtubeStats(profile: SocialProfile, apiKey: string | null, fetcher: Fetcher = fetch): Promise<YouTubeStats> {
  const url = profile.url;
  if (!apiKey) return { status: 'unavailable', message: 'YouTube numbers are not set up on this server.', url };
  const h = profile.handle ?? '';
  const lookup: Record<string, string> | null = h.startsWith('UC') ? { id: h } : h.startsWith('@') ? { forHandle: h } : h.startsWith('user/') ? { forUsername: h.slice(5) } : null;
  if (!lookup) return { status: 'unresolved', message: 'This link uses an old custom address the YouTube API cannot look up; open it to see the channel.', url };
  try {
    const q = new URLSearchParams({ part: 'snippet,statistics,contentDetails', ...lookup, key: apiKey });
    const res = await getJson(fetcher, `https://www.googleapis.com/youtube/v3/channels?${q}`);
    if (!res.ok) return { status: 'error', message: `YouTube answered HTTP ${res.status}.`, url };
    const channel = res.body?.items?.[0];
    if (!channel) return { status: 'not_found', message: 'YouTube has no channel at this link.', url };
    const stats = channel.statistics ?? {};
    let lastUploadAt: string | null = null;
    const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
    if (uploads) {
      const items = await getJson(fetcher, `https://www.googleapis.com/youtube/v3/playlistItems?${new URLSearchParams({ part: 'contentDetails', playlistId: uploads, maxResults: '1', key: apiKey })}`).catch(() => null);
      lastUploadAt = items?.ok ? items.body?.items?.[0]?.contentDetails?.videoPublishedAt ?? null : null;
    }
    return {
      status: 'ok',
      channelId: String(channel.id),
      title: String(channel.snippet?.title ?? ''),
      subscribers: stats.hiddenSubscriberCount ? null : num(stats.subscriberCount),
      videos: num(stats.videoCount) ?? 0,
      views: num(stats.viewCount) ?? 0,
      lastUploadAt,
      url,
    };
  } catch {
    return { status: 'error', message: 'YouTube could not be reached.', url };
  }
}

/**
 * Public numbers of another Instagram professional account through Business Discovery. `viewer` is the company's own
 * Instagram professional account and the access token of the Page it belongs to.
 */
export async function instagramStats(
  profile: SocialProfile,
  viewer: { igUserId: string; token: string; appSecret: string; version: string } | null,
  fetcher: Fetcher = fetch,
): Promise<InstagramStats> {
  const url = profile.url;
  const username = (profile.handle ?? '').toLowerCase();
  if (!viewer) return { status: 'unavailable', message: 'Connect an Instagram professional account (through Meta) to see Instagram numbers.', url };
  if (!/^[a-z0-9._]{1,30}$/.test(username)) return { status: 'not_found', message: 'This link does not name an Instagram account.', url };
  try {
    const fields = `business_discovery.username(${username}){username,name,followers_count,media_count,media.limit(1){timestamp}}`;
    const proof = createHmac('sha256', viewer.appSecret).update(viewer.token).digest('hex');
    const q = new URLSearchParams({ fields, access_token: viewer.token, ...(viewer.appSecret ? { appsecret_proof: proof } : {}) });
    const res = await getJson(fetcher, `https://graph.facebook.com/${viewer.version}/${viewer.igUserId}?${q}`);
    const d = res.body?.business_discovery;
    if (!res.ok || !d) {
      const message = String(res.body?.error?.message ?? '');
      // Personal accounts and unknown usernames come back as "invalid user id" style errors.
      if (/cannot be found|invalid user id|does not exist|business_discovery/i.test(message) || res.status === 400) return { status: 'not_found', message: 'Instagram shows numbers only for business or creator accounts; this one is personal or does not exist.', url };
      return { status: 'error', message: `Instagram answered HTTP ${res.status}.`, url };
    }
    return {
      status: 'ok',
      username: String(d.username ?? username),
      name: d.name ? String(d.name) : null,
      followers: num(d.followers_count) ?? 0,
      posts: num(d.media_count) ?? 0,
      lastPostAt: d.media?.data?.[0]?.timestamp ?? null,
      url,
    };
  } catch {
    return { status: 'error', message: 'Instagram could not be reached.', url };
  }
}
