#!/usr/bin/env bash
# Runs once after the container is created (and after every rebuild).
set -euo pipefail

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# --- Claude Code config volume -----------------------------------------------
# Docker creates a named volume owned by root when its mount point doesn't
# already exist in the image. Nothing pre-creates ~/.claude here, so repair the
# ownership before Claude Code tries to write its token. The `! -w` guard keeps
# this a no-op once correct, so rebuilds don't re-chown accumulated history.
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-${HOME}/.claude}"
if [ -d "$CLAUDE_DIR" ] && [ ! -w "$CLAUDE_DIR" ]; then
	echo "Fixing ownership of $CLAUDE_DIR"
	sudo chown -R "$(id -u):$(id -g)" "$CLAUDE_DIR"
fi

# --- Bun ---------------------------------------------------------------------
# Pinned by version *and* by the SHA-256 of the release artifact, so a
# republished asset fails the build instead of silently changing the toolchain.
#
# To bump: raise BUN_VERSION and replace both checksums from that release's
# SHASUMS256.txt —
#   curl -sL https://github.com/oven-sh/bun/releases/download/bun-v<VERSION>/SHASUMS256.txt \
#     | grep -E 'bun-linux-(x64|aarch64)\.zip$'
BUN_VERSION="1.3.14"
BUN_SHA256_X64="951ee2aee855f08595aeec6225226a298d3fea83a3dcd6465c09cbccdf7e848f"
BUN_SHA256_AARCH64="a27ffb63a8310375836e0d6f668ae17fa8d8d18b88c37c821c65331973a19a3b"

install_bun() {
	local arch sha asset

	case "$(uname -m)" in
		x86_64)        arch="x64";     sha="$BUN_SHA256_X64" ;;
		aarch64|arm64) arch="aarch64"; sha="$BUN_SHA256_AARCH64" ;;
		*)
			echo "Unsupported architecture: $(uname -m)" >&2
			return 1
			;;
	esac
	asset="bun-linux-${arch}.zip"

	if ! command -v unzip >/dev/null 2>&1; then
		sudo apt-get update && sudo apt-get install -y --no-install-recommends unzip
	fi

	echo "Installing Bun ${BUN_VERSION} (${arch})"
	curl -fsSL -o "${TMP_DIR}/${asset}" \
		"https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/${asset}"

	# Fails the script before anything is unpacked if the artifact doesn't match.
	echo "${sha}  ${TMP_DIR}/${asset}" | sha256sum -c -

	# -j flattens the archive's `bun-linux-<arch>/` prefix, so the layout inside
	# the zip is not a second thing to keep in sync.
	unzip -qj "${TMP_DIR}/${asset}" '*/bun' -d "$TMP_DIR"
	sudo install -m 0755 "${TMP_DIR}/bun" /usr/local/bin/bun
}

if ! command -v bun >/dev/null 2>&1 || [ "$(bun --version)" != "$BUN_VERSION" ]; then
	install_bun
fi

echo "Bun $(bun --version)"

# Same install CI performs, so a fresh container matches a fresh CI run.
bun install --frozen-lockfile
