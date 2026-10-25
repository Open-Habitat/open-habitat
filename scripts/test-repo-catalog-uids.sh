#!/usr/bin/env bash
# Offline, disposable three-UID repository proof; never touches host gh, git,
# tea or a real Gitea. The GitHub catalog and clone run against fixture
# programs; the read-only Gitea connector runs real Git, the native helper and
# a synthetic Gitea whose CA is in the container's system trust.
# The image adds Git to Ubuntu 24.04 once (network only while building).
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
export TMPDIR=/var/tmp
mkdir -p "$repo/.cache"
image=localhost/open-habitat-repo-uids:ubuntu-24.04-git
if ! podman image exists "$image"; then
  printf 'FROM docker.io/library/ubuntu:24.04\nRUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*\n' |
    podman build -q -t "$image" -f - >/dev/null
fi
CGO_ENABLED=0 go test -c -o "$repo/.cache/repo-catalog-uid.test" "$repo/internal/daemon"
podman run --rm --network none \
  -v "$repo/.cache/repo-catalog-uid.test:/opt/repo-catalog-uid.test:ro" \
  "$image" \
  /bin/sh -ec '
    printf "agent-a:x:21001:21001::/var/tmp/catalog-agent-a:/bin/sh\nagent-b:x:21002:21002::/var/tmp/catalog-agent-b:/bin/sh\nfixture-gateway:x:21003:21003::/var/tmp/catalog-gateway:/bin/sh\n" >>/etc/passwd
    printf "agent-a:x:21001:\nagent-b:x:21002:\nfixture-gateway:x:21003:\n" >>/etc/group
    cp /opt/repo-catalog-uid.test /var/tmp/repo-catalog-uid.test
    chmod 755 /var/tmp/repo-catalog-uid.test
    REPO_UID_CONTAINER=1 /var/tmp/repo-catalog-uid.test -test.run "^(TestRepoCatalogDistinctUIDs|TestGiteaDistinctUIDs)$" -test.v
  '
