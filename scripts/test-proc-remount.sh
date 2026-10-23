#!/usr/bin/env bash
# Real remount commands in a disposable rootless namespace, never the host's /proc.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
[[ $(id -u) != 0 ]] || { echo 'rootless invocation required' >&2; exit 1; }
[[ $(podman info --format '{{.Host.Security.Rootless}}') == true ]]
export TMPDIR=/var/tmp
mkdir -p "$repo/.cache"
CGO_ENABLED=0 go test -c -o "$repo/.cache/proc-remount.test" "$repo/internal/host"
podman run --rm --pull=never --network=none --userns=keep-id --user=0 --cap-add=SYS_ADMIN \
  -v "$repo/.cache/proc-remount.test:/fixture/proc.test:ro" \
  docker.io/library/ubuntu:24.04 /bin/sh -ec '
    groupadd -g 988 open-habitat-proc
    HOST_PROC_REMOUNT_CONTAINER=1 /fixture/proc.test -test.run "^TestPrepareProcNumericRemountNative$" -test.v
  '
