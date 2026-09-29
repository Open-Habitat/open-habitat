#!/usr/bin/env bash
# Fixed deployment path and protected gateway directory proof; no host paths are changed.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
[[ $(id -u) != 0 ]] || { echo 'rootless invocation required' >&2; exit 1; }
command -v podman >/dev/null
[[ $(podman info --format '{{.Host.Security.Rootless}}') == true ]]
export TMPDIR=/var/tmp
mkdir -p "$repo/.cache"
CGO_ENABLED=0 go test -c -o "$repo/.cache/shared-pi-selector.test" "$repo/internal/core"
podman run --rm --pull=never --network none --cap-drop=ALL --cap-add=SETUID --cap-add=SETGID --cap-add=CHOWN --cap-add=FOWNER \
  -v "$repo/.cache/shared-pi-selector.test:/fixture/selector.test:ro" \
  docker.io/library/ubuntu:24.04 /bin/sh -ec '
    cp /fixture/selector.test /tmp/selector.test
    chmod 755 /tmp/selector.test
    PI_SELECTOR_CONTAINER=1 /tmp/selector.test -test.run "^TestSharedPiRuntimeAcrossUIDs$" -test.v
  '
