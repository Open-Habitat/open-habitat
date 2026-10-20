#!/usr/bin/env bash
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
# A standalone release build also needs disk-backed staging and Go temp files.
export TMPDIR=/var/tmp
version= target= web_dir= output=
while (($#)); do case "$1" in --version) version=$2;shift 2;;--target) target=$2;shift 2;;--web-dir) web_dir=$2;shift 2;;--output) output=$2;shift 2;;*) echo "error: unknown argument $1" >&2;exit 1;;esac;done
[[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][A-Za-z0-9.-]+)?$ ]] || { echo "error: invalid --version '$version'" >&2;exit 1; }
[[ $target == linux-amd64 ]] || { echo "error: unsupported --target '$target'; expected linux-amd64" >&2;exit 1; }
[[ -f $web_dir/index.html ]] || { echo "error: --web-dir '$web_dir' is not a Vite build" >&2;exit 1; }
if grep -R -E 'Alder-testifixture|Deterministinen testi: daemon' "$web_dir" >/dev/null;then echo "error: test fixture content found in --web-dir '$web_dir'" >&2;exit 1;fi
mkdir -p "$output"; output=$(cd "$output"&&pwd)
# Keep generated binary staging inside the ignored source output tree, so the
# shared build runner can return it without arbitrary absolute-path writeback.
mkdir -p "$repo/.cache"
stage=$(mktemp -d "$repo/.cache/release-package.XXXXXX"); trap 'rm -rf "$stage"' EXIT
name="open-habitat-$version-$target"; root="$stage/$name"; mkdir -p "$root/bin" "$root/web" "$root/systemd" "$root/sysusers.d" "$root/tmpfiles.d" "$root/licenses"
commit=$(git -C "$repo" rev-parse HEAD)
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -buildvcs=false -ldflags "-s -w -buildid= -X github.com/Open-Habitat/open-habitat/internal/cli.version=$version -X github.com/Open-Habitat/open-habitat/internal/cli.buildCommit=$commit" -o "${root#"$repo/"}/bin/open-habitat" ./cmd/open-habitat
cp -a "$web_dir"/. "$root/web/"
# Vite source maps contain original source (including test-only flag references).
# They are not required to serve the client and must not ship in a pilot package.
find "$root/web" -type f -name '*.map' -delete
if grep -R -E 'Alder-testifixture|Deterministinen testi: daemon|VITE_ENABLE_TEST_FIXTURES' "$root/web" >/dev/null; then
  echo "error: test fixture content or control found in packaged web assets" >&2; exit 1
fi
cp -a "$repo"/systemd/. "$root/systemd/"; cp "$repo"/sysusers.d/* "$root/sysusers.d/"; cp "$repo"/tmpfiles.d/* "$root/tmpfiles.d/"; cp "$repo/licenses/DEPENDENCIES.md" "$root/licenses/"
( cd "$root"; find . -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 sha256sum > MANIFEST.sha256 )
archive="$output/$name.tar.gz"; tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner -C "$stage" -cf - "$name" | gzip -n > "$archive"
(cd "$output"; sha256sum "$(basename "$archive")" > "$(basename "$archive").sha256")
printf '%s\n' "$archive"
