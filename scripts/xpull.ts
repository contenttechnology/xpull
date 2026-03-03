#!/usr/bin/env bun
/**
 * xpull — Pull tweets from X home timeline and lists.
 *
 * Commands:
 *   auth                          Run OAuth 2.0 PKCE flow
 *   feed [options]                Pull home timeline
 *   list <id_or_name> [options]   Pull tweets from a list
 *   lists                         Show your owned lists
 *
 * Feed options:
 *   --limit N              Max tweets (default: 20)
 *   --exclude-retweets     Exclude retweets
 *   --exclude-replies      Exclude replies
 *   --json                 Raw JSON output
 *
 * List options:
 *   --limit N              Max tweets (default: 25)
 *   --json                 Raw JSON output
 */

import { authorize } from "./lib/auth";
import * as api from "./lib/api";
import * as fmt from "./lib/format";

// --- Arg parsing ---

const args = process.argv.slice(2);
const command = args[0];

function getFlag(name: string): boolean {
  const idx = args.indexOf(`--${name}`);
  if (idx >= 0) {
    args.splice(idx, 1);
    return true;
  }
  return false;
}

function getOpt(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < args.length) {
    const val = args[idx + 1];
    args.splice(idx, 2);
    return val;
  }
  return undefined;
}

// --- Commands ---

async function cmdAuth() {
  await authorize();
}

async function cmdFeed() {
  const limit = parseInt(getOpt("limit") || "20");
  const since = getOpt("since");
  const excludeRetweets = getFlag("exclude-retweets");
  const excludeReplies = getFlag("exclude-replies");
  const asJson = getFlag("json");

  const tweets = await api.homeTimeline({
    limit,
    excludeRetweets,
    excludeReplies,
    since,
  });

  if (tweets.length === 0) {
    console.log("No tweets found.");
    return;
  }

  let header = "Home Timeline";
  if (since) header += ` (since ${since})`;

  if (asJson) {
    console.log(JSON.stringify(tweets, null, 2));
  } else {
    console.log(fmt.formatResults(tweets, { header, limit }));
  }
}

async function cmdList() {
  const nameOrId = args[1];
  if (!nameOrId) {
    console.error("Usage: xpull list <id_or_name> [--limit N] [--json]");
    process.exit(1);
  }

  const limit = parseInt(getOpt("limit") || "25");
  const asJson = getFlag("json");

  const listId = await api.resolveListId(nameOrId);
  const tweets = await api.listTweets(listId, { limit });

  if (tweets.length === 0) {
    console.log("No tweets found in this list.");
    return;
  }

  if (asJson) {
    console.log(JSON.stringify(tweets, null, 2));
  } else {
    console.log(fmt.formatResults(tweets, { header: `List ${listId}`, limit }));
  }
}

async function cmdLists() {
  const lists = await api.ownedLists();

  if (lists.length === 0) {
    console.log("No owned lists found.");
    return;
  }

  console.log(`Your lists (${lists.length}):\n`);
  for (const l of lists) {
    const priv = l.private ? " [private]" : "";
    console.log(`  ${l.id} — ${l.name}${priv} (${l.member_count} members)`);
    if (l.description) {
      console.log(`    ${l.description.slice(0, 80)}`);
    }
  }
}

function usage() {
  console.log(`xpull — Pull tweets from X home timeline and lists

Commands:
  auth                          Run OAuth 2.0 PKCE flow
  feed [options]                Pull home timeline (default 20 tweets)
  list <id_or_name> [options]   Pull tweets from a list (default 25)
  lists                         Show your owned lists

Feed options:
  --limit N              Max tweets to fetch (default: 20)
  --since <time>         Only tweets after this time (e.g. 2h, 3d, 2026-02-24, 2026-02-24T14:00:00Z)
  --exclude-retweets     Exclude retweets
  --exclude-replies      Exclude replies
  --json                 Raw JSON output

List options:
  --limit N              Max tweets to fetch (default: 25)
  --json                 Raw JSON output

Setup:
  1. Set X_CLIENT_ID env var (from https://developer.x.com/en/portal/dashboard)
  2. Run: xpull auth`);
}

// --- Main ---

async function main() {
  switch (command) {
    case "auth":
      await cmdAuth();
      break;
    case "feed":
    case "f":
      await cmdFeed();
      break;
    case "list":
    case "l":
      await cmdList();
      break;
    case "lists":
    case "ls":
      await cmdLists();
      break;
    default:
      usage();
  }
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
