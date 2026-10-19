#!/usr/bin/env bash
# Distinct actual kernel UIDs in a disposable, networkless rootless container:
# the broker's boot restore starts only the daemon of a committed person whose
# integrations boot signal is their own, enables linger only for committed
# NSS-verified accounts, and reads nothing inside any home.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$repo/.cache"
export TMPDIR=/var/tmp
CGO_ENABLED=0 go test -c -o "$repo/.cache/broker-boot-uid.test" "$repo/internal/provision"
podman run --rm --network none \
  -v "$repo/.cache/broker-boot-uid.test:/opt/broker-boot-uid.test:ro" \
  docker.io/library/ubuntu:24.04 \
  /bin/sh -ec '
    cp /opt/broker-boot-uid.test /var/tmp/broker-boot-uid.test
    chmod 755 /var/tmp/broker-boot-uid.test
    cd /var/tmp
    PROVISION_UID_CONTAINER=1 /var/tmp/broker-boot-uid.test -test.run "^TestBootSyncDistinctUIDs$" -test.v
  '
