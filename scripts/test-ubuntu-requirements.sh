#!/usr/bin/env bash
# Opt-in real apt qualification. Installs only inside a disposable rootless guest.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
source "$repo/scripts/scratch.sh"
oh_scratch_dir work oh-apt-test
# Compilation needs no socket paths; all disposable output stays under scratch.
export TMPDIR="$work"
trap 'rm -rf "$work"' EXIT
(cd "$repo"; CGO_ENABLED=0 go test -c -o "$work/host.test" ./internal/host)
podman run --rm --pull=never --network=slirp4netns --user 0 \
  -v "$repo/runtime:/requirements:ro" -v "$work/host.test:/host.test:ro" \
  ubuntu:24.04 bash -euc '
export TMPDIR=/var/tmp
apt-get update -qq
HOST_UBUNTU_APT_CONTAINER=1 /host.test -test.run ^TestUbuntuNativeAptContainer$ -test.v -test.timeout 35m
HOST_UBUNTU_APT_CONTAINER=1 /host.test -test.run ^TestServerBrowserChromeAptContainer$ -test.v -test.timeout 35m
'
