#!/usr/bin/env bash
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
archive="$repo/.cache/go1.27.1.linux-amd64.tar.gz"
mkdir -p "$repo/.cache" "$repo/.tools"
if [[ ! -x $repo/.tools/go/bin/go ]];then
  curl -fsSL --retry 3 --retry-all-errors https://go.dev/dl/go1.27.1.linux-amd64.tar.gz -o "$archive"
  echo "63d339f0da5ab53635a56f2490a7984dfe12dfcff22ad749f63edaf590168445  $archive" | sha256sum -c -
  rm -rf "$repo/.tools/go";tar -xzf "$archive" -C "$repo/.tools"
fi
printf 'export PATH=%q:$PATH\n' "$repo/.tools/go/bin"
