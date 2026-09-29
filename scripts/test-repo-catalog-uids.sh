#!/usr/bin/env bash
# Offline, disposable three-UID repository catalog and clone proof; never touches host gh or git.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
export TMPDIR=/var/tmp
mkdir -p "$repo/.cache"
CGO_ENABLED=0 go test -c -o "$repo/.cache/repo-catalog-uid.test" "$repo/internal/daemon"
podman run --rm --network none \
  -v "$repo/.cache/repo-catalog-uid.test:/opt/repo-catalog-uid.test:ro" \
  docker.io/library/ubuntu:24.04 \
  /bin/sh -ec '
    printf "agent-a:x:21001:21001::/var/tmp/catalog-agent-a:/bin/sh\nagent-b:x:21002:21002::/var/tmp/catalog-agent-b:/bin/sh\nfixture-gateway:x:21003:21003::/var/tmp/catalog-gateway:/bin/sh\n" >>/etc/passwd
    cp /opt/repo-catalog-uid.test /var/tmp/repo-catalog-uid.test
    chmod 755 /var/tmp/repo-catalog-uid.test
    REPO_UID_CONTAINER=1 /var/tmp/repo-catalog-uid.test -test.run "^TestRepoCatalogDistinctUIDs$" -test.v
  '
