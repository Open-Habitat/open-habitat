#!/usr/bin/env bash
# Kernel capability boundary in a private container network namespace; no host
# listener, capability, sysctl or installed unit is changed.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
export TMPDIR=/var/tmp
umask 077
mkdir -p "$repo/.cache"
CGO_ENABLED=0 go test -c -o "$repo/.cache/gateway-bind.test" "$repo/internal/host"
chmod 0755 "$repo/.cache/gateway-bind.test"
podman run --rm --network none \
  --sysctl net.ipv4.ip_unprivileged_port_start=1024 \
  --cap-drop ALL --cap-add SETUID --cap-add SETGID --cap-add SETPCAP --cap-add NET_BIND_SERVICE \
  -e HOST_BIND_CONTAINER=1 \
  -v "$repo/.cache/gateway-bind.test:/opt/gateway-bind.test:ro" \
  docker.io/library/ubuntu:24.04 \
  /opt/gateway-bind.test -test.run '^TestGatewayNativeLowPort$' -test.v
