#!/usr/bin/env bash
# Root filesystem transactions and distinct-UID access denials in a disposable,
# networkless container. Not an installed/systemd/quota/activation acceptance run.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$repo/.cache"
export TMPDIR=/var/tmp
CGO_ENABLED=0 go test -c -o "$repo/.cache/host-installation.test" "$repo/internal/host"
CGO_ENABLED=0 go test -c -o "$repo/.cache/provision-installation.test" "$repo/internal/provision"
CGO_ENABLED=0 go test -c -o "$repo/.cache/cli-installation.test" "$repo/internal/cli"
podman run --rm --network none \
  -v "$repo/.cache/host-installation.test:/opt/host-installation.test:ro" \
  -v "$repo/.cache/provision-installation.test:/opt/provision-installation.test:ro" \
  -v "$repo/.cache/cli-installation.test:/opt/cli-installation.test:ro" \
  -v "$repo/site/example.json:/opt/example-site.json:ro" \
  docker.io/library/ubuntu:24.04 \
  /bin/sh -ec '
    mkdir -p /site
    cp /opt/example-site.json /site/example.json
    cd /root
    HOST_INIT_UID_CONTAINER=1 /opt/host-installation.test -test.run "^Test(Operation(DistinctUIDs|LockAndInterruptedPhase|IncompleteAtomicWrite|InterruptedBeginDoesNotCreateReceipts)|Inspection.*|HomeObservation.*)$" -test.v
    HOST_INIT_UID_CONTAINER=1 /opt/cli-installation.test -test.run "^TestHost" -test.v
    /opt/provision-installation.test -test.run "^Test(Initialize|PublishAdmission)" -test.v
  '
