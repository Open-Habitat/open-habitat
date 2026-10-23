#!/usr/bin/env bash
# Build-time network resolution only, in a disposable Ubuntu 24.04 container.
set -euo pipefail
export TMPDIR=/var/tmp
repo=$(cd "$(dirname "$0")/.." && pwd)
[[ $# == 1 && $1 == /* && ! -e $1 ]] || { echo 'usage: build-core-runtime.sh NEW_ABSOLUTE_OUTPUT_DIRECTORY' >&2; exit 1; }
mkdir -m 700 "$1"
out=$1
podman run --rm --pull=never --network=slirp4netns --user 0 \
  -v "$repo/runtime/core:/inputs:ro" -v "$repo/scripts/core-runtime-build.py:/builder.py:ro" \
  -v "$out:/output" localhost/open-habitat-vm-tools:prereq bash -euc '
export TMPDIR=/var/tmp
mkdir -p /var/tmp/core
cd /var/tmp/core
curl -fsSL --max-time 300 https://nodejs.org/dist/v22.21.1/node-v22.21.1-linux-x64.tar.xz -o node.tar.xz
echo "680d3f30b24a7ff24b98db5e96f294c0070f8f9078df658da1bce1b9c9873c88  node.tar.xz" | sha256sum -c -
python3 -c '\''import tarfile; tarfile.open("node.tar.xz").extractall(filter="data")'\''
export PATH=/var/tmp/core/node-v22.21.1-linux-x64/bin:/usr/bin:/bin
mkdir npm
cp /inputs/package*.json npm/
(cd npm && npm ci --ignore-scripts --no-audit --no-fund)
python3 /builder.py /var/tmp/core /output
'
# Container root is this rootless caller; outputs remain private.
chmod -R u+rwX "$out"
printf '%s\n' "$out"
