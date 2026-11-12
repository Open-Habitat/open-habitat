#!/usr/bin/env bash
# Fetch only the checked-in profile lock, in disposable Ubuntu, then inventory.
# The target defaults to this host's architecture. Profiles that only fetch and
# inventory pinned upstream files build for either target anywhere; the
# integrations profile runs npm on its locked Node, so it needs a host of the
# target's architecture.
set -euo pipefail
source "$(dirname "$0")/scratch.sh"
TMPDIR=$(oh_scratch_root); export TMPDIR
repo=$(cd "$(dirname "$0")/.." && pwd)
case $(uname -m) in x86_64) host=linux-amd64;; aarch64) host=linux-arm64;; *) host=;; esac
target=$host
if [[ ${1:-} == --target ]]; then target=${2:-}; shift 2 || true; fi
[[ $# == 2 && $1 =~ ^[a-z][a-z0-9-]{0,62}$ && $2 == /* && ! -e $2 ]] || { echo 'usage: build-profile-runtime.sh [--target linux-amd64|linux-arm64] PROFILE NEW_ABSOLUTE_OUTPUT_DIRECTORY' >&2; exit 1; }
[[ $target == linux-amd64 || $target == linux-arm64 ]] || { echo "error: unsupported target '$target'" >&2; exit 1; }
profile=$1 out=$2
[[ -f $repo/runtime/profiles/$profile/ubuntu-packages.json || ( ( $profile == editor || $profile == uv || $profile == python || $profile == integrations ) && -f $repo/runtime/profiles/$profile/artifact-lock.json ) ]] || { echo 'error: locked profile unavailable' >&2; exit 1; }
# Python's full upstream metadata is zstd: this file-only builder requires
# Python 3.14's tar reader. It neither installs nor executes the fetched runtime.
if [[ $profile == python ]]; then
  python3 -c 'import compression.zstd' || { echo 'error: Python 3.14 zstd reader required for build' >&2; exit 1; }
  oh_scratch_dir work ohpy
  trap 'rm -rf "$work"' EXIT
  mkdir "$work/inputs"
  cp "$repo/runtime/profiles/python/artifact-lock.json" "$work/inputs/"
  python3 "$repo/scripts/download-profile-inputs.py" "$work/inputs/artifact-lock.json" "$work/inputs" "$target"
  python3 "$repo/scripts/python-runtime-build.py" "$work/inputs/artifact-lock.json" "$work/inputs" "$work/output" "$target"
  mv "$work/output" "$out"
  printf '%s\n' "$out"
  exit 0
fi
if [[ $profile == integrations && $target != "$host" ]]; then
  echo "error: build integrations for $target on a $target host; this host is ${host:-unsupported}" >&2; exit 1
fi
image=$("$repo/scripts/runtime-builder-image.sh")
# The mount parent is private, and the builder refuses an existing output child.
oh_scratch_dir work ohpr
trap 'rm -rf "$work"' EXIT
if [[ $profile == integrations ]]; then
  mkdir "$work/inputs"
  cp "$repo/runtime/profiles/integrations/"{package.json,package-lock.json,ms-365-mcp-server-scopes.json,artifact-lock.json,ubuntu-packages.json,microsoft-native.mjs,microsoft-native-cli.mjs,NOTICE,gog-THIRD-PARTY-NOTICES,rclone-THIRD-PARTY-NOTICES,tea-THIRD-PARTY-NOTICES,glab-THIRD-PARTY-NOTICES,sops-THIRD-PARTY-NOTICES,tailscale-THIRD-PARTY-NOTICES,tailscaled-THIRD-PARTY-NOTICES} "$work/inputs/"
  podman run --rm --pull=never --network=slirp4netns --user 0 \
    -v "$work:/work" -v "$repo/scripts:/scripts:ro" -v "$repo/runtime/core/package-lock.json:/runtime/core/package-lock.json:ro" \
    "$image" bash -euc '
export TMPDIR=/var/tmp
python3 /scripts/download-profile-inputs.py /work/inputs/artifact-lock.json /work/inputs "$1"
prefix=$(python3 - "$1" <<'"'"'PY'"'"'
import hashlib, json, sys, tarfile, urllib.request
pin = json.load(open("/work/inputs/artifact-lock.json"))["node"]["targets"][sys.argv[1]]
data = urllib.request.urlopen(pin["url"], timeout=120).read()
assert hashlib.sha256(data).hexdigest() == pin["sha256"], "locked Node digest mismatch"
open("/work/node.tar.xz", "wb").write(data)
tarfile.open("/work/node.tar.xz").extractall("/work/node", filter="data")
print(pin["prefix"])
PY
)
mkdir /work/npm
export PATH=/work/node/$prefix/bin:/usr/bin:/bin
cp /work/inputs/package*.json /work/npm/
(cd /work/npm && npm ci --ignore-scripts --no-audit --no-fund)
python3 /scripts/integrations-runtime-build.py /work/inputs /work/npm /work/node.tar.xz /work/output "$1"
' -- "$target"
  mv "$work/output" "$out"
  printf '%s\n' "$out"
  exit 0
fi
if [[ $profile == editor || $profile == uv ]]; then
  mkdir "$work/inputs"
  cp "$repo/runtime/profiles/$profile/artifact-lock.json" "$work/inputs/"
  podman run --rm --pull=never --network=slirp4netns --user 0 \
    -v "$work:/work" -v "$repo/scripts:/scripts:ro" \
    "$image" bash -euc '
python3 /scripts/download-profile-inputs.py /work/inputs/artifact-lock.json /work/inputs "$2"
if test "$1" = editor; then
  python3 /scripts/editor-runtime-build.py /work/inputs/artifact-lock.json /work/inputs/editor.tar.gz /work/output "$2"
else
  python3 /scripts/uv-runtime-build.py /work/inputs/artifact-lock.json /work/inputs /work/output "$2"
fi
' -- "$profile" "$target"
  mv "$work/output" "$out"
  printf '%s\n' "$out"
  exit 0
fi
mkdir "$work/inputs" "$work/inputs/debs"
cp "$repo/runtime/profiles/$profile/ubuntu-packages.json" "$work/inputs/"
if [[ $profile == containers || $profile == browser ]]; then
  cp "$repo/runtime/profiles/$profile/artifact-lock.json" "$work/inputs/"
fi
podman run --rm --pull=never --network=slirp4netns --user 0 \
  -v "$work:/work" -v "$repo/scripts:/repo/scripts:ro" -v "$repo/runtime:/repo/runtime:ro" \
  "$image" bash -euc '
if test "$1" = containers; then
  python3 -c '"'"'import json,pathlib,urllib.request,hashlib; p=pathlib.Path("/work/inputs"); d=json.loads((p/"artifact-lock.json").read_text()); data=urllib.request.urlopen(d["url"],timeout=120).read(); assert hashlib.sha256(data).hexdigest()==d["sha256"]; (p/d["filename"]).write_bytes(data)'"'"'
fi
if test "$1" = browser; then
  python3 /repo/scripts/download-profile-inputs.py /work/inputs/artifact-lock.json /work/inputs "$2"
fi
python3 /repo/scripts/profile-runtime-build.py "$1" /work/inputs /work/output "$2"
' -- "$profile" "$target"
mv "$work/output" "$out"
printf '%s\n' "$out"
