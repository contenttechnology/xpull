# xpull

A CLI tool for pulling tweets from your X (Twitter) home timeline and lists. Built with TypeScript and Bun, using OAuth 2.0 PKCE for user-context authentication.

Also works as a [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skill — invoke it with `/xpull` from any conversation.

## Prerequisites

- [Bun](https://bun.sh) runtime
- An X Developer App with OAuth 2.0 enabled ([X Developer Portal](https://developer.x.com/en/portal/dashboard))
  - Set the callback URL to `http://localhost:3456/callback`

## Setup

1. Ensure `X_CLIENT_ID` is set as an environment variable (from [X Developer Portal](https://developer.x.com/en/portal/dashboard)).

2. Authorize with X:
   ```bash
   bun run scripts/xpull.ts auth
   ```
   This opens a browser for OAuth approval. Tokens are saved to the `data/` folder within the skill directory (created automatically if it doesn't exist) and auto-refresh on expiry.

## Usage

```bash
# Pull your home timeline (default: 20 tweets)
bun run scripts/xpull.ts feed

# Recent tweets only
bun run scripts/xpull.ts feed --since 2h

# Filter out noise
bun run scripts/xpull.ts feed --limit 30 --exclude-retweets --exclude-replies

# Pull tweets from a list (by name or ID)
bun run scripts/xpull.ts list "AI Builders" --limit 20

# Show your owned lists
bun run scripts/xpull.ts lists

# JSON output for further processing
bun run scripts/xpull.ts feed --json
```

### Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `auth` | | Run OAuth 2.0 PKCE authorization flow |
| `feed [options]` | `f` | Pull home timeline |
| `list <id_or_name> [options]` | `l` | Pull tweets from a specific list |
| `lists` | `ls` | Show your owned lists |

### Feed Options

| Option | Description |
|--------|-------------|
| `--limit N` | Max tweets to fetch (default: 20) |
| `--since <time>` | Only tweets after this time — `30m`, `6h`, `2d`, or ISO date |
| `--exclude-retweets` | Filter out retweets |
| `--exclude-replies` | Filter out replies |
| `--json` | Output raw JSON |

### List Options

| Option | Description |
|--------|-------------|
| `--limit N` | Max tweets to fetch (default: 25) |
| `--json` | Output raw JSON |

## Claude Code Skill

To install as a Claude Code skill:

```bash
./install.sh
```

This copies the skill files into `~/.claude/skills/xpull`. You can then invoke it in Claude Code with `/xpull`.

## Project Structure

```
xpull/
├── scripts/
│   └── xpull.ts          CLI entry point
├── lib/
│   ├── auth.ts           OAuth 2.0 PKCE flow & token management
│   ├── api.ts            X API v2 client (timelines, lists)
│   └── format.ts         Terminal output formatting
├── data/
│   └── tokens.json       OAuth tokens (gitignored, created at runtime)
├── SKILL.md              Claude Code skill definition
├── install.sh            Skill installer
└── package.json
```

## License

ISC
