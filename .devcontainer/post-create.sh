#!/usr/bin/env bash
# Runs once after the container is created (and after every rebuild).
set -euo pipefail

# Docker creates a named volume owned by root when its mount point doesn't
# already exist in the image. Nothing pre-creates ~/.claude here, so repair the
# ownership before Claude Code tries to write its token. The `! -w` guard keeps
# this a no-op once correct, so rebuilds don't re-chown accumulated history.
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-${HOME}/.claude}"
if [ -d "$CLAUDE_DIR" ] && [ ! -w "$CLAUDE_DIR" ]; then
	echo "Fixing ownership of $CLAUDE_DIR"
	sudo chown -R "$(id -u):$(id -g)" "$CLAUDE_DIR"
fi

# Bun is the package manager and test runner for this project. It ships on npm
# as the official distribution, which keeps the install inside the registry the
# project already depends on rather than piping a remote script into a shell.
if ! command -v bun >/dev/null 2>&1; then
	echo "Installing Bun"
	npm install -g bun
fi

echo "Bun $(bun --version)"

# Same install CI performs, so a fresh container matches a fresh CI run.
bun install --frozen-lockfile
