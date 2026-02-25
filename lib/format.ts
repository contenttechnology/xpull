/**
 * Format tweets for output.
 */

import type { Tweet } from "./api";

export function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/**
 * Format a single tweet (monospace-friendly).
 */
export function formatTweet(t: Tweet, index?: number, opts?: { full?: boolean }): string {
  const prefix = index !== undefined ? `${index + 1}. ` : "";
  const engagement = `${compactNumber(t.metrics.likes)}L ${compactNumber(t.metrics.retweets)}RT ${compactNumber(t.metrics.impressions)}I`;
  const time = timeAgo(t.created_at);

  const text = opts?.full || t.text.length <= 280 ? t.text : t.text.slice(0, 277) + "...";
  const cleanText = text.replace(/https:\/\/t\.co\/\S+/g, "").trim();

  let out = `${prefix}@${t.username} (${engagement} · ${time})\n${cleanText}`;

  if (t.urls.length > 0) {
    out += `\n${t.urls[0]}`;
  }
  out += `\n${t.tweet_url}`;

  return out;
}

/**
 * Format a list of tweets.
 */
export function formatResults(
  tweets: Tweet[],
  opts: { header?: string; limit?: number } = {}
): string {
  const limit = opts.limit || 20;
  const shown = tweets.slice(0, limit);

  let out = "";
  if (opts.header) {
    out += `${opts.header} — ${tweets.length} tweets\n\n`;
  }

  out += shown.map((t, i) => formatTweet(t, i)).join("\n\n");

  if (tweets.length > limit) {
    out += `\n\n... +${tweets.length - limit} more`;
  }

  return out;
}
