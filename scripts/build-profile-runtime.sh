#!/usr/bin/env bash
# Fetch only the checked-in profile lock, in disposable Ubuntu, then inventory.
set -euo pipefail
export TMPDIR=/var/tmp
repo=$(cd "$(dirname "$0")/.." && pwd)
[[ $# == 2 && $1 =~ ^[a-z][a-z0-9-]{0,62}$ && $2 == /* && ! -e $2 ]] || { echo 'usage: build-profile-runtime.sh PROFILE NEW_ABSOLUTE_OUTPUT_DIRECTORY' >&2; exit 1; }
profile=$1 out=$2
[[ -f $repo/runtime/profiles/$profile/ubuntu-packages.json || ( ( $profile == editor || $profile == uv ) && -f $repo/runtime/profiles/$profile/artifact-lock.json ) ]] || { echo 'error: locked profile unavailable' >&2; exit 1; }
# The mount parent is private, and the builder refuses an existing output child.
work=$(mktemp -d /var/tmp/oh-profile-build.XXXXXXXX)
trap 'rm -rf "$work"' EXIT
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
podman run --rm --pull=never --network=slirp4netns --user 0 \
  -v "$work:/work" -v "$repo/scripts/profile-runtime-build.py:/builder.py:ro" \
  localhost/open-habitat-vm-tools:prereq bash -euc '
apt-get update -qq
cd /work/inputs/debs
python3 -c '\''import json,subprocess;d=json.load(open("../ubuntu-packages.json"));subprocess.run(["apt-get","download",*[p["name"]+":"+p["architecture"]+"="+p["version"] for p in d["packages"]]],check=True)'\''
python3 /builder.py "$1" /work/inputs /work/output
' -- "$profile"
mv "$work/output" "$out"
printf '%s\n' "$out"
