#!/usr/bin/env bash
# Confined editor reads/writes under distinct kernel UIDs, and bind-mount
# refusal in a private mount namespace. No installed-host/systemd claim.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
export TMPDIR=/var/tmp
umask 077
mkdir -p "$repo/.cache"
CGO_ENABLED=0 go test -c -o "$repo/.cache/editor-files-uid.test" "$repo/internal/daemon"
podman run --rm --network none --cap-add SYS_ADMIN \
  -v "$repo/.cache/editor-files-uid.test:/opt/editor-files-uid.test:ro" \
  docker.io/library/ubuntu:24.04 /bin/sh -ec '
    cp /opt/editor-files-uid.test /var/tmp/editor-files-uid.test
    chmod 755 /var/tmp/editor-files-uid.test
    EDITOR_UID_CONTAINER=1 /var/tmp/editor-files-uid.test -test.run "^TestEditorFiles(DistinctUIDs|MountRefused)$" -test.v
  '
