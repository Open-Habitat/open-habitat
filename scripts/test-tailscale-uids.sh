#!/usr/bin/env bash
# The person's Tailscale node with actual kernel UIDs in a disposable,
# networkless rootless container: the pinned tailscaled from the
# integrations profile, run with the daemon's own command line and config as
# one user, is unreachable for a second user and keeps shields up.
# Downloads the pinned archive for this machine's target once (digest
# checked against runtime/profiles/integrations/artifact-lock.json).
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
export TMPDIR=/var/tmp
case $(uname -m) in
  aarch64) target=linux-arm64 ;;
  x86_64) target=linux-amd64 ;;
  *) echo "unsupported machine" >&2; exit 1 ;;
esac
mkdir -p "$repo/.cache/tailscale-$target"
dir="$repo/.cache/tailscale-$target"
python3 - "$repo/runtime/profiles/integrations/artifact-lock.json" "$target" "$dir" <<'PY'
import hashlib, json, sys, tarfile, urllib.request
from pathlib import Path
lock, target, out = json.load(open(sys.argv[1])), sys.argv[2], Path(sys.argv[3])
tools = {t['name']: t for t in lock['tools'] if t.get('target') == target and t['name'] in ('tailscale', 'tailscaled')}
archive = tools['tailscaled']['archive']
pin = next(i for i in lock['inputs'] if i.get('target') == target and i['filename'] == archive)
path = out / archive
if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != pin['sha256']:
    with urllib.request.urlopen(pin['url'], timeout=120) as r:
        data = r.read()
    if hashlib.sha256(data).hexdigest() != pin['sha256']:
        sys.exit('locked digest mismatch')
    path.write_bytes(data)
with tarfile.open(path) as t:
    for name, tool in tools.items():
        data = t.extractfile(t.getmember(tool['member'])).read()
        if hashlib.sha256(data).hexdigest() != tool['sha256']:
            sys.exit('tool digest mismatch: ' + name)
        (out / name).write_bytes(data)
        (out / name).chmod(0o755)
PY
CGO_ENABLED=0 go test -c -o "$repo/.cache/tailscale-uid.test" "$repo/internal/daemon"
podman run --rm --network none \
  -v "$repo/.cache/tailscale-uid.test:/opt/tailscale-uid.test:ro" \
  -v "$dir/tailscaled:/opt/ts/tailscaled:ro" -v "$dir/tailscale:/opt/ts/tailscale:ro" \
  docker.io/library/ubuntu:24.04 /bin/sh -ec '
    printf "agent-a:x:21001:21001::/home/agent-a:/usr/sbin/nologin\nagent-b:x:21002:21002::/nonexistent:/usr/sbin/nologin\n" >>/etc/passwd
    cp /opt/tailscale-uid.test /var/tmp/tailscale-uid.test
    chmod 755 /var/tmp/tailscale-uid.test
    TAILNET_UID_CONTAINER=1 OH_TAILSCALED=/opt/ts/tailscaled OH_TAILSCALE=/opt/ts/tailscale \
      /var/tmp/tailscale-uid.test -test.run "^TestTailnetNodeDistinctUIDs$" -test.v
  '
