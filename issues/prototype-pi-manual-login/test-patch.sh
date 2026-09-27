#!/usr/bin/env bash
set -euo pipefail
issue_dir=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d "${TMPDIR:-/tmp}/pi-manual-patch-XXXXXXXX")
trap 'rm -rf "$work"' EXIT
export HOME="$work/home" PI_CODING_AGENT_DIR="$work/home/.pi/agent" PI_OFFLINE=1 PI_TELEMETRY=0
export npm_config_cache="$work/npm-cache" npm_config_update_notifier=false
mkdir -p "$HOME" "$PI_CODING_AGENT_DIR"
# npm's signed publish provenance for @earendil-works/pi-coding-agent@0.85.1
# resolves refs/tags/v0.85.1 to this exact source commit (see result.md).
revision=d981de1229ef899957bbe968bc8dcda02a21f477
repository=https://github.com/earendil-works/pi.git
git clone --quiet --depth 1 --branch v0.85.1 "$repository" "$work/pi"
cd "$work/pi"
[ "$(git rev-parse HEAD)" = "$revision" ] || { echo 'Source revision mismatch' >&2; exit 1; }
[ "$(node -p "require('./packages/coding-agent/package.json').version")" = 0.85.1 ] || exit 1
[ "$(node -p "require('./packages/ai/package.json').version")" = 0.85.1 ] || exit 1
git apply --check "$issue_dir/pi-0.85.1-manual-only.patch"
git apply "$issue_dir/pi-0.85.1-manual-only.patch"
npm ci --ignore-scripts --no-audit --no-fund
./node_modules/.bin/biome check packages/ai/src/auth/types.ts packages/ai/src/auth/oauth/openai-codex.ts packages/ai/test/openai-codex-manual-only.test.ts
./node_modules/.bin/vitest run packages/ai/test/openai-codex-manual-only.test.ts packages/ai/test/openai-codex-oauth.test.ts
printf 'PASS pinned source, patch, formatting, native Codex OAuth tests (synthetic only)\n'
