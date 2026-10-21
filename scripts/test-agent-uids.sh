#!/usr/bin/env bash
# Real owner, other-user, gateway and root peers in a disposable networkless container.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
export TMPDIR=/var/tmp
mkdir -p "$repo/.cache"
go test -race -c -o "$repo/.cache/agent-uid.test" "$repo/internal/daemon"
go test -race -c -o "$repo/.cache/agent-provision-uid.test" "$repo/internal/provision"
go test -race -c -o "$repo/.cache/agent-activation-uid.test" "$repo/internal/cli"
podman run --rm --network none \
  -v "$repo/.cache/agent-uid.test:/opt/agent-uid.test:ro" \
  -v "$repo/.cache/agent-provision-uid.test:/opt/agent-provision-uid.test:ro" \
  -v "$repo/.cache/agent-activation-uid.test:/opt/agent-activation-uid.test:ro" \
  docker.io/library/ubuntu:24.04 /bin/sh -ec '
    printf "synthetic-agent:x:21001:21001::/nonexistent:/bin/sh\n" >> /etc/passwd
    cp /opt/agent-activation-uid.test /var/tmp/agent-activation-uid.test
    chmod 755 /var/tmp/agent-activation-uid.test
    AGENT_UID_CONTAINER=1 /var/tmp/agent-activation-uid.test -test.run "^TestAgentActivatedPairDistinctUIDs$" -test.v
    cp /opt/agent-uid.test /var/tmp/agent-uid.test
    chmod 755 /var/tmp/agent-uid.test
    cp /opt/agent-provision-uid.test /var/tmp/agent-provision-uid.test
    chmod 755 /var/tmp/agent-provision-uid.test
    AGENT_UID_CONTAINER=1 /var/tmp/agent-provision-uid.test -test.run "^TestAgentSocketRouteDistinctUIDs$" -test.v
    AGENT_UID_CONTAINER=1 /var/tmp/agent-uid.test -test.run "^TestAgentDistinctUIDs$" -test.v
  '
