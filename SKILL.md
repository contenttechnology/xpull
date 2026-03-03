---
name: xpull
description: >
  Pull tweets from X home timeline and lists. Fetches the authenticated user's
  following feed or tweets from specific X Lists using OAuth 2.0 user-context auth.
  Use when: (1) user says "xpull", "/xpull", "pull my feed", "pull my timeline",
  "check my x feed", "check x list", "what's on my timeline",
  (2) user wants to see what accounts they follow are posting about,
  (3) user wants to pull tweets from a specific X list.
  NOT for: searching X (use x-research), posting tweets, account management.
---

# xpull — X Feed & List Pull

Pull tweets from your X home timeline (following feed) and from X Lists.

## Setup

Requires OAuth 2.0 user-context authentication (app-only bearer tokens won't work for home timeline).

1. Set `X_CLIENT_ID` env var (from [X Developer Portal](https://developer.x.com/en/portal/dashboard))
2. Run auth: `bun run scripts/xpull.ts auth`

## CLI

All commands run from the skill directory (where this SKILL.md lives):

```bash
cd "$(dirname "$SKILL_PATH")"
```

### Auth

```bash
bun run scripts/xpull.ts auth
```

Runs OAuth 2.0 PKCE flow — opens browser, user approves, tokens stored locally. Tokens auto-refresh (2hr expiry).

### Feed (Home Timeline)

```bash
bun run scripts/xpull.ts feed [--limit N] [--exclude-retweets] [--exclude-replies] [--json]
```

Pulls tweets from the authenticated user's home timeline (reverse chronological).
Default: 20 tweets.

### List Tweets

```bash
bun run scripts/xpull.ts list <id_or_name> [--limit N] [--json]
```

Pulls tweets from a specific list. Accepts numeric list ID or list name (matched against owned lists).
Default: 25 tweets.

### Show Owned Lists

```bash
bun run scripts/xpull.ts lists
```

Shows all lists owned by the authenticated user with IDs, names, and member counts.

## Usage Patterns

**Quick feed check:**
```bash
bun run scripts/xpull.ts feed --limit 10
```

**Feed without noise:**
```bash
bun run scripts/xpull.ts feed --limit 30 --exclude-retweets --exclude-replies
```

**Pull from a list by name:**
```bash
bun run scripts/xpull.ts list "AI Builders" --limit 20
```

**JSON for further processing:**
```bash
bun run scripts/xpull.ts feed --limit 5 --json
```

## File Structure

```
xpull/
├── SKILL.md           (this file)
├── scripts/
│   └── xpull.ts       (CLI entry point)
├── lib/
│   ├── auth.ts        (OAuth 2.0 PKCE flow, token storage/refresh)
│   ├── api.ts         (X API: home timeline, list tweets, owned lists)
│   └── format.ts      (output formatting)
├── data/
│   └── tokens.json    (created at runtime, gitignored)
└── package.json
```
