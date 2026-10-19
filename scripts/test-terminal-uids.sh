#!/usr/bin/env bash
# The browser shell with actual mapped kernel UIDs in a disposable, networkless
# rootless container: each person's shell runs as that person in their
# workspace, cannot read another's home or reach their tmux server, survives
# its connection, and only the gateway's UID reaches a daemon socket.
# The image adds tmux to Ubuntu 24.04 once (network only while building).
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$repo/.cache"
export TMPDIR=/var/tmp
image=localhost/open-habitat-terminal-uids:ubuntu-24.04-tmux
if ! podman image exists "$image"; then
  printf 'FROM docker.io/library/ubuntu:24.04\nRUN apt-get update && apt-get install -y --no-install-recommends tmux && rm -rf /var/lib/apt/lists/*\n' |
    podman build -q -t "$image" -f - >/dev/null
fi
CGO_ENABLED=0 go test -c -o "$repo/.cache/terminal-uid.test" "$repo/internal/daemon"
podman run --rm --network none \
  -v "$repo/.cache/terminal-uid.test:/opt/terminal-uid.test:ro" \
  "$image" \
  /bin/sh -ec '
    printf "agent-a:x:21001:21001::/nonexistent:/usr/sbin/nologin\nagent-b:x:21002:21002::/nonexistent:/usr/sbin/nologin\nfixture-gateway:x:21003:21003::/nonexistent:/usr/sbin/nologin\n" >>/etc/passwd
    cp /opt/terminal-uid.test /tmp/terminal-uid.test
    chmod 755 /tmp/terminal-uid.test
    TERMINAL_UID_CONTAINER=1 /tmp/terminal-uid.test -test.run "^TestTerminalDistinctUIDs$" -test.v
  '
