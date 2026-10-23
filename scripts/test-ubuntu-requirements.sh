#!/usr/bin/env bash
# Opt-in real apt qualification. Installs only inside a disposable rootless guest.
set -euo pipefail
export TMPDIR=/var/tmp
repo=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d /var/tmp/oh-apt-test.XXXXXXXX)
trap 'rm -rf "$work"' EXIT
(cd "$repo"; CGO_ENABLED=0 go test -c -o "$work/host.test" ./internal/host)
podman run --rm --pull=never --network=slirp4netns --user 0 \
  -v "$repo/runtime:/requirements:ro" -v "$work/host.test:/host.test:ro" \
  ubuntu:24.04 bash -euc '
export TMPDIR=/var/tmp
apt-get update -qq
HOST_UBUNTU_APT_CONTAINER=1 /host.test -test.run ^TestUbuntuNativeAptContainer$ -test.v -test.timeout 35m
'
