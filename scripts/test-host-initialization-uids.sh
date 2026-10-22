#!/usr/bin/env bash
# Root filesystem transactions and distinct-UID access denials in a disposable,
# networkless container. Not an installed/systemd/quota/activation acceptance run.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$repo/.cache"
export TMPDIR=/var/tmp
CGO_ENABLED=0 go test -c -o "$repo/.cache/host-installation.test" "$repo/internal/host"
CGO_ENABLED=0 go test -c -o "$repo/.cache/provision-installation.test" "$repo/internal/provision"
podman run --rm --network none \
  -v "$repo/.cache/host-installation.test:/opt/host-installation.test:ro" \
  -v "$repo/.cache/provision-installation.test:/opt/provision-installation.test:ro" \
  docker.io/library/ubuntu:24.04 \
  /bin/sh -ec '
    cd /root
    HOST_INIT_UID_CONTAINER=1 /opt/host-installation.test -test.run "^TestOperation(DistinctUIDs|LockAndInterruptedPhase|IncompleteAtomicWrite)$" -test.v
    /opt/provision-installation.test -test.run "^Test(Initialize|PublishAdmission)" -test.v
  '
