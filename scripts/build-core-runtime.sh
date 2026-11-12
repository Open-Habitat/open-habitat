#!/usr/bin/env bash
# Build-time network resolution only, in a disposable Ubuntu 24.04 container.
# npm resolves the target CPU's optional packages and runs on the locked Node,
# so a target is built on a host of its own architecture.
set -euo pipefail
source "$(dirname "$0")/scratch.sh"
TMPDIR=$(oh_scratch_root); export TMPDIR
repo=$(cd "$(dirname "$0")/.." && pwd)
case $(uname -m) in x86_64) host=linux-amd64;; aarch64) host=linux-arm64;; *) host=;; esac
target=$host
if [[ ${1:-} == --target ]]; then target=${2:-}; shift 2 || true; fi
[[ $# == 1 && $1 == /* && ! -e $1 ]] || { echo 'usage: build-core-runtime.sh [--target linux-amd64|linux-arm64] NEW_ABSOLUTE_OUTPUT_DIRECTORY' >&2; exit 1; }
[[ $target == linux-amd64 || $target == linux-arm64 ]] || { echo "error: unsupported target '$target'" >&2; exit 1; }
[[ $target == "$host" ]] || { echo "error: build $target on a $target host; this host is ${host:-unsupported}" >&2; exit 1; }
image=$("$repo/scripts/runtime-builder-image.sh")
mkdir -m 700 "$1"
out=$1
podman run --rm --pull=never --network=slirp4netns --user 0 \
  -v "$repo/runtime/core:/inputs:ro" -v "$repo/scripts:/scripts:ro" \
  -v "$out:/output" "$image" bash -euc '
export TMPDIR=/var/tmp
mkdir -p /var/tmp/core
cd /var/tmp/core
prefix=$(python3 - "$1" <<'"'"'PY'"'"'
import hashlib, json, sys, tarfile, urllib.request
pin = json.load(open("/inputs/artifact-lock.json"))["node"]["targets"][sys.argv[1]]
data = urllib.request.urlopen(pin["url"], timeout=300).read()
assert hashlib.sha256(data).hexdigest() == pin["sha256"], "locked Node digest mismatch"
open("node.tar.xz", "wb").write(data)
tarfile.open("node.tar.xz").extractall(filter="data")
print(pin["prefix"])
PY
)
mkdir browser
python3 /scripts/download-profile-inputs.py /inputs/browser-lock.json /var/tmp/core/browser "$1"
export PATH=/var/tmp/core/$prefix/bin:/usr/bin:/bin
mkdir npm
cp /inputs/package*.json npm/
(cd npm && npm ci --ignore-scripts --no-audit --no-fund)
python3 /scripts/core-runtime-build.py /var/tmp/core /output "$1"
' -- "$target"
# Container root is this rootless caller; outputs remain private.
chmod -R u+rwX "$out"
printf '%s\n' "$out"
