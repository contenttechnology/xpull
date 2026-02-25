/**
 * X API wrapper — home timeline, list tweets, owned lists.
 * Uses OAuth 2.0 user-context tokens from auth.ts.
 */

import { getAuth } from "./auth";

const BASE = "https://api.x.com/2";
const RATE_DELAY_MS = 350;

export interface Tweet {
  id: string;
  text: string;
  author_id: string;
  username: string;
  name: string;
  created_at: string;
  conversation_id: string;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    impressions: number;
    bookmarks: number;
  };
  urls: string[];
  mentions: string[];
  hashtags: string[];
  tweet_url: string;
}

interface RawResponse {
  data?: any[];
  includes?: { users?: any[] };
  meta?: { next_token?: string; result_count?: number };
  errors?: any[];
  title?: string;
  detail?: string;
  status?: number;
}

export interface XList {
  id: string;
  name: string;
  description?: string;
  member_count: number;
  follower_count: number;
  created_at: string;
  private: boolean;
}

function parseTweets(raw: RawResponse): Tweet[] {
  if (!raw.data) return [];
  const users: Record<string, any> = {};
  for (const u of raw.includes?.users || []) {
    users[u.id] = u;
  }

  return raw.data.map((t: any) => {
    const u = users[t.author_id] || {};
    const m = t.public_metrics || {};
    return {
      id: t.id,
      text: t.text,
      author_id: t.author_id,
      username: u.username || "?",
      name: u.name || "?",
      created_at: t.created_at,
      conversation_id: t.conversation_id,
      metrics: {
        likes: m.like_count || 0,
        retweets: m.retweet_count || 0,
        replies: m.reply_count || 0,
        quotes: m.quote_count || 0,
        impressions: m.impression_count || 0,
        bookmarks: m.bookmark_count || 0,
      },
      urls: (t.entities?.urls || [])
        .map((u: any) => u.expanded_url)
        .filter(Boolean),
      mentions: (t.entities?.mentions || [])
        .map((m: any) => m.username)
        .filter(Boolean),
      hashtags: (t.entities?.hashtags || [])
        .map((h: any) => h.tag)
        .filter(Boolean),
      tweet_url: `https://x.com/${u.username || "?"}/status/${t.id}`,
    };
  });
}

const TWEET_FIELDS =
  "tweet.fields=created_at,public_metrics,author_id,conversation_id,entities&expansions=author_id&user.fields=username,name,public_metrics";

async function apiGet(url: string, accessToken: string): Promise<RawResponse> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 429) {
    const reset = res.headers.get("x-rate-limit-reset");
    const waitSec = reset
      ? Math.max(parseInt(reset) - Math.floor(Date.now() / 1000), 1)
      : 60;
    throw new Error(`Rate limited. Resets in ${waitSec}s`);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`X API ${res.status}: ${body.slice(0, 300)}`);
  }

  return res.json();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Pull home timeline (reverse chronological).
 */
export async function homeTimeline(opts: {
  limit?: number;
  excludeRetweets?: boolean;
  excludeReplies?: boolean;
} = {}): Promise<Tweet[]> {
  const { accessToken, userId } = await getAuth();
  const limit = opts.limit || 20;

  // API max_results is 1-100
  const perPage = Math.min(limit, 100);
  const pages = Math.ceil(limit / perPage);

  const exclude: string[] = [];
  if (opts.excludeRetweets) exclude.push("retweets");
  if (opts.excludeReplies) exclude.push("replies");
  const excludeParam = exclude.length > 0 ? `&exclude=${exclude.join(",")}` : "";

  let allTweets: Tweet[] = [];
  let nextToken: string | undefined;

  for (let page = 0; page < pages; page++) {
    const pagination = nextToken ? `&pagination_token=${nextToken}` : "";
    const url = `${BASE}/users/${userId}/timelines/reverse_chronological?max_results=${perPage}&${TWEET_FIELDS}${excludeParam}${pagination}`;

    const raw = await apiGet(url, accessToken);
    const tweets = parseTweets(raw);
    allTweets.push(...tweets);

    nextToken = raw.meta?.next_token;
    if (!nextToken || allTweets.length >= limit) break;
    if (page < pages - 1) await sleep(RATE_DELAY_MS);
  }

  return allTweets.slice(0, limit);
}

/**
 * Pull tweets from a list by list ID.
 */
export async function listTweets(listId: string, opts: {
  limit?: number;
} = {}): Promise<Tweet[]> {
  const { accessToken } = await getAuth();
  const limit = opts.limit || 25;
  const perPage = Math.min(limit, 100);

  let allTweets: Tweet[] = [];
  let nextToken: string | undefined;
  const pages = Math.ceil(limit / perPage);

  for (let page = 0; page < pages; page++) {
    const pagination = nextToken ? `&pagination_token=${nextToken}` : "";
    const url = `${BASE}/lists/${listId}/tweets?max_results=${perPage}&${TWEET_FIELDS}${pagination}`;

    const raw = await apiGet(url, accessToken);
    const tweets = parseTweets(raw);
    allTweets.push(...tweets);

    nextToken = raw.meta?.next_token;
    if (!nextToken || allTweets.length >= limit) break;
    if (page < pages - 1) await sleep(RATE_DELAY_MS);
  }

  return allTweets.slice(0, limit);
}

/**
 * Get owned lists for the authenticated user.
 */
export async function ownedLists(): Promise<XList[]> {
  const { accessToken, userId } = await getAuth();
  const url = `${BASE}/users/${userId}/owned_lists?list.fields=description,member_count,follower_count,created_at,private`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`X API ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json() as { data?: any[] };
  if (!data.data) return [];

  return data.data.map((l: any) => ({
    id: l.id,
    name: l.name,
    description: l.description || "",
    member_count: l.member_count || 0,
    follower_count: l.follower_count || 0,
    created_at: l.created_at || "",
    private: l.private || false,
  }));
}

/**
 * Resolve a list name to its ID. If the input is already numeric, return as-is.
 */
export async function resolveListId(nameOrId: string): Promise<string> {
  // If it looks like a numeric ID, use directly
  if (/^\d+$/.test(nameOrId)) return nameOrId;

  const lists = await ownedLists();
  const match = lists.find(
    (l) => l.name.toLowerCase() === nameOrId.toLowerCase()
  );

  if (!match) {
    const available = lists.map((l) => `  ${l.id} — ${l.name}`).join("\n");
    throw new Error(
      `List "${nameOrId}" not found. Your lists:\n${available || "  (none)"}`
    );
  }

  return match.id;
}
