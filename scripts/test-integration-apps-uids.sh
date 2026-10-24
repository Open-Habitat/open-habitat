#!/usr/bin/env bash
# Distinct actual kernel UIDs in a disposable, networkless rootless container:
# the broker's writer sets and clears Google's app section of the production
# /opt/open-habitat/integrations.json under the host operation lock, and a
# second person's daemon catalog, run as that person, sees Google become
# available and then wait for app credentials again. The person can read the
# file but not write it or look inside the lock directory.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$repo/.cache"
export TMPDIR=/var/tmp
CGO_ENABLED=0 go test -c -o "$repo/.cache/integration-apps-uid.test" "$repo/internal/daemon/integrations"
podman run --rm --network none \
  -v "$repo/.cache/integration-apps-uid.test:/opt/integration-apps-uid.test:ro" \
  docker.io/library/ubuntu:24.04 \
  /bin/sh -ec '
    cp /opt/integration-apps-uid.test /usr/local/bin/integration-apps-uid.test
    chmod 755 /usr/local/bin/integration-apps-uid.test
    cd /var/tmp
    INTEGRATION_APPS_UID_CONTAINER=1 /usr/local/bin/integration-apps-uid.test -test.run "^TestBrokerAppReachesAnotherUsersDaemon$" -test.v
  '
