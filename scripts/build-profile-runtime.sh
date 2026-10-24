#!/usr/bin/env bash
# Fetch only the checked-in profile lock, in disposable Ubuntu, then inventory.
set -euo pipefail
export TMPDIR=/var/tmp
repo=$(cd "$(dirname "$0")/.." && pwd)
[[ $# == 2 && $1 =~ ^[a-z][a-z0-9-]{0,62}$ && $2 == /* && ! -e $2 ]] || { echo 'usage: build-profile-runtime.sh PROFILE NEW_ABSOLUTE_OUTPUT_DIRECTORY' >&2; exit 1; }
profile=$1 out=$2
[[ -f $repo/runtime/profiles/$profile/ubuntu-packages.json || ( ( $profile == editor || $profile == uv || $profile == python || $profile == integrations ) && -f $repo/runtime/profiles/$profile/artifact-lock.json ) ]] || { echo 'error: locked profile unavailable' >&2; exit 1; }
# Python's full upstream metadata is zstd: this file-only builder requires
# Python 3.14's tar reader. It neither installs nor executes the fetched runtime.
if [[ $profile == python ]]; then
  python3 -c 'import compression.zstd' || { echo 'error: Python 3.14 zstd reader required for build' >&2; exit 1; }
  work=$(mktemp -d /var/tmp/oh-python-build.XXXXXXXX)
  trap 'rm -rf "$work"' EXIT
  mkdir "$work/inputs"
  cp "$repo/runtime/profiles/python/artifact-lock.json" "$work/inputs/"
  python3 "$repo/scripts/download-profile-inputs.py" "$work/inputs/artifact-lock.json" "$work/inputs"
  python3 "$repo/scripts/python-runtime-build.py" "$work/inputs/artifact-lock.json" "$work/inputs" "$work/output"
  mv "$work/output" "$out"
  printf '%s\n' "$out"
  exit 0
fi
# The mount parent is private, and the builder refuses an existing output child.
work=$(mktemp -d /var/tmp/oh-profile-build.XXXXXXXX)
trap 'rm -rf "$work"' EXIT
if [[ $profile == integrations ]]; then
  mkdir "$work/inputs"
  cp "$repo/runtime/profiles/integrations/"{package.json,package-lock.json,artifact-lock.json,ubuntu-packages.json,microsoft-native.mjs,microsoft-native-cli.mjs,NOTICE} "$work/inputs/"
  podman run --rm --pull=never --network=slirp4netns --user 0 \
    -v "$work:/work" -v "$repo/scripts:/scripts:ro" \
    localhost/open-habitat-vm-tools:prereq bash -euc '
export TMPDIR=/var/tmp
python3 /scripts/download-profile-inputs.py /work/inputs/artifact-lock.json /work/inputs
python3 -c '\''import json,urllib.request,hashlib; from pathlib import Path; p=Path("/work"); d=json.loads((p/"inputs/artifact-lock.json").read_text())["node"]; b=urllib.request.urlopen(d["url"],timeout=120).read(); assert hashlib.sha256(b).hexdigest()==d["sha256"]; (p/"node.tar.xz").write_bytes(b)'\''
mkdir /work/node /work/npm
python3 -c '\''import tarfile; tarfile.open("/work/node.tar.xz").extractall("/work/node",filter="data")'\''
export PATH=/work/node/node-v22.21.1-linux-x64/bin:/usr/bin:/bin
cp /work/inputs/package*.json /work/npm/
(cd /work/npm && npm ci --ignore-scripts --no-audit --no-fund)
python3 /scripts/integrations-runtime-build.py /work/inputs /work/npm /work/node.tar.xz /work/output
'
  mv "$work/output" "$out"
  printf '%s\n' "$out"
  exit 0
fi
if [[ $profile == editor || $profile == uv ]]; then
  mkdir "$work/inputs"
  cp "$repo/runtime/profiles/$profile/artifact-lock.json" "$work/inputs/"
  podman run --rm --pull=never --network=slirp4netns --user 0 \
    -v "$work:/work" -v "$repo/scripts:/scripts:ro" \
    localhost/open-habitat-vm-tools:prereq bash -euc '
python3 /scripts/download-profile-inputs.py /work/inputs/artifact-lock.json /work/inputs
if test "$1" = editor; then
  python3 /scripts/editor-runtime-build.py /work/inputs/artifact-lock.json /work/inputs/editor.tar.gz /work/output
else
  python3 /scripts/uv-runtime-build.py /work/inputs/artifact-lock.json /work/inputs /work/output
fi
' -- "$profile"
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
  localhost/open-habitat-vm-tools:prereq bash -euc '
if test "$1" = containers; then
  python3 -c '"'"'import json,pathlib,urllib.request,hashlib; p=pathlib.Path("/work/inputs"); d=json.loads((p/"artifact-lock.json").read_text()); data=urllib.request.urlopen(d["url"],timeout=120).read(); assert hashlib.sha256(data).hexdigest()==d["sha256"]; (p/d["filename"]).write_bytes(data)'"'"'
fi
if test "$1" = browser; then
  python3 /repo/scripts/download-profile-inputs.py /work/inputs/artifact-lock.json /work/inputs
fi
python3 /repo/scripts/profile-runtime-build.py "$1" /work/inputs /work/output
' -- "$profile"
mv "$work/output" "$out"
printf '%s\n' "$out"
