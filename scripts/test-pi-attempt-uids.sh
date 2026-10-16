#!/usr/bin/env bash
# Three actual mapped kernel UIDs in a disposable, networkless rootless container.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$repo/.cache"
export TMPDIR=/var/tmp
CGO_ENABLED=0 go test -c -o "$repo/.cache/pi-attempt-uid.test" "$repo/internal/daemon"
podman run --rm --network none \
  -v "$repo/.cache/pi-attempt-uid.test:/opt/pi-attempt-uid.test:ro" \
  docker.io/library/ubuntu:24.04 \
  /bin/sh -ec '
    printf "agent-a:x:21001:21001::/tmp/agent-a:/bin/sh\nagent-b:x:21002:21002::/tmp/agent-b:/bin/sh\nfixture-gateway:x:21003:21003::/tmp/gateway:/bin/sh\n" >>/etc/passwd
    cp /opt/pi-attempt-uid.test /tmp/pi-attempt-uid.test
    chmod 755 /tmp/pi-attempt-uid.test
    PI_UID_CONTAINER=1 /tmp/pi-attempt-uid.test -test.run "^Test(PiAttempt|PiDialog|Process)DistinctUIDs$" -test.v
  '
