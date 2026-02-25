#!/bin/bash
# Install xpull skill into ~/.claude/skills/

SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="$HOME/.claude/skills/xpull"

mkdir -p "$HOME/.claude/skills"

if [ -L "$TARGET" ]; then
  echo "Updating existing symlink..."
  rm "$TARGET"
elif [ -e "$TARGET" ]; then
  echo "Error: $TARGET exists and is not a symlink. Remove it first."
  exit 1
fi

ln -s "$SKILL_DIR" "$TARGET"
echo "Installed: $TARGET -> $SKILL_DIR"
