#!/usr/bin/env bash
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
# A standalone release build also needs disk-backed staging and Go temp files.
export TMPDIR=${TMPDIR:-/var/tmp}
version= target= web_dir= output=
while (($#)); do case "$1" in --version) version=$2;shift 2;;--target) target=$2;shift 2;;--web-dir) web_dir=$2;shift 2;;--output) output=$2;shift 2;;*) echo "error: unknown argument $1" >&2;exit 1;;esac;done
[[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][A-Za-z0-9.-]+)?$ ]] || { echo "error: invalid --version '$version'" >&2;exit 1; }
case $target in linux-amd64) goarch=amd64;; linux-arm64) goarch=arm64;; *) echo "error: unsupported --target '$target'; expected linux-amd64 or linux-arm64" >&2;exit 1;; esac
[[ -f $web_dir/index.html ]] || { echo "error: --web-dir '$web_dir' is not a Vite build" >&2;exit 1; }
if grep -R -E 'Synthetic-lab-fixture|Deterministinen testi: daemon' "$web_dir" >/dev/null;then echo "error: test fixture content found in --web-dir '$web_dir'" >&2;exit 1;fi
mkdir -p "$output"; output=$(cd "$output"&&pwd)
# Keep generated binary staging inside the ignored source output tree, so the
# shared build runner can return it without arbitrary absolute-path writeback.
mkdir -p "$repo/.cache"
stage=$(mktemp -d "$repo/.cache/release-package.XXXXXX"); trap 'rm -rf "$stage"' EXIT
name="open-habitat-$version-$target"; root="$stage/$name"; mkdir -p "$root/bin" "$root/web" "$root/systemd" "$root/sysusers.d" "$root/tmpfiles.d" "$root/licenses" "$root/site" "$root/operator"
commit=$(git -C "$repo" rev-parse HEAD)
# Regenerate in private build sources: the approved checkout stays clean even
# when parallel UI work left the checked-in development references behind.
build_repo="$stage/source"
mkdir -p "$build_repo/scripts" "$build_repo/web"
(cd "$repo" && tar --exclude=node_modules -cf - cmd internal go.mod go.sum policy.go systemd tmpfiles.d apparmor.d needrestart) | tar -xf - -C "$build_repo"
cp "$repo/scripts/generate-ui-reference.py" "$build_repo/scripts/"
ln -s "$repo/web/src" "$build_repo/web/src"
python3 "$build_repo/scripts/generate-ui-reference.py"
(cd "$build_repo" && CGO_ENABLED=0 GOOS=linux GOARCH=$goarch go build -trimpath -buildvcs=false -ldflags "-s -w -buildid= -X github.com/open-habitat/open-habitat/internal/cli.version=$version -X github.com/open-habitat/open-habitat/internal/cli.buildCommit=$commit" -o "$root/bin/open-habitat" ./cmd/open-habitat)
(cd "$build_repo" && CGO_ENABLED=0 GOOS=linux GOARCH=$goarch go build -trimpath -buildvcs=false -ldflags "-s -w -buildid=" -o "$root/bin/runtime-release" ./cmd/runtime-release)
cp -a "$web_dir"/. "$root/web/"
# Vite source maps contain original source (including test-only flag references).
# They are not required to serve the client and must not ship in a pilot package.
find "$root/web" -type f -name '*.map' -delete
if grep -R -E 'Synthetic-lab-fixture|Deterministinen testi: daemon|VITE_ENABLE_TEST_FIXTURES' "$root/web" >/dev/null; then
  echo "error: test fixture content or control found in packaged web assets" >&2; exit 1
fi
cp -a "$repo"/systemd/. "$root/systemd/"; cp "$repo"/sysusers.d/* "$root/sysusers.d/"; cp "$repo"/tmpfiles.d/* "$root/tmpfiles.d/"; cp "$repo/licenses/DEPENDENCIES.md" "$root/licenses/"
cp "$repo/site/schema.json" "$repo/site/example.json" "$root/site/"
# The skill text depends on the version, not the architecture; print it with
# the same build for this host, so a cross-built package carries the same bytes.
(cd "$build_repo" && CGO_ENABLED=0 go build -trimpath -buildvcs=false -ldflags "-X github.com/open-habitat/open-habitat/internal/cli.version=$version -X github.com/open-habitat/open-habitat/internal/cli.buildCommit=$commit" -o "$stage/skill-printer" ./cmd/open-habitat)
"$stage/skill-printer" skill print operator > "$root/operator/SKILL.md"
# Canonical public package modes must not inherit the build shell's umask.
find "$root" -type d -exec chmod 0755 {} +
find "$root" -type f -exec chmod 0644 {} +
chmod 0755 "$root/bin/open-habitat" "$root/bin/runtime-release"
( cd "$root"; find . -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 sha256sum > MANIFEST.sha256 )
chmod 0644 "$root/MANIFEST.sha256"
archive="$output/$name.tar.gz"; tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner -C "$stage" -cf - "$name" | gzip -n > "$archive"
(cd "$output"; sha256sum "$(basename "$archive")" > "$(basename "$archive").sha256")
printf '%s\n' "$archive"
