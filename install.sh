#!/bin/bash
# Install xpull skill into ~/.claude/skills/

SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="$HOME/.claude/skills/xpull"

mkdir -p "$TARGET"

echo "Copying skill files to $TARGET..."
cp "$SKILL_DIR/SKILL.md" "$TARGET/"
cp "$SKILL_DIR/package.json" "$TARGET/"
cp -r "$SKILL_DIR/scripts" "$TARGET/"
mkdir -p "$TARGET/data"

echo "Installing dependencies..."
(cd "$TARGET" && bun install)

echo "Installed xpull skill to $TARGET"
