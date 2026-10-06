#!/usr/bin/env bash
# Disposable, loopback-only browser lab; never uses a real Pi or home.
set -euo pipefail
cd "$(dirname "$0")/.."
root=$PWD
state=$root/.cache/lab
pidfile=$state/host.pid
preferred=$(node --input-type=module -e 'import { ports } from "./web/test-ports.mjs"; console.log(ports.lab)')
portfile=$state/port
port=$(cat "$portfile" 2>/dev/null || echo "$preferred")
url=https://127.0.0.1:$port
mkdir -p "$state/shots" /var/tmp/open-habitat-build
export TMPDIR=/var/tmp/open-habitat-build
alive() {
  [[ -f $pidfile ]] && kill -0 "$(cat "$pidfile")" 2>/dev/null &&
    tr '\0' ' ' < "/proc/$(cat "$pidfile")/cmdline" | grep -Fq "$root/.cache/browser-host $root/web/dist"
}
case "${1:-}" in
  start)
    exec 9>"$state/lock"
    flock 9
    if alive; then echo "$url"; exit 0; fi
    rm -f "$pidfile"
    # Prefer the usual port, but choose a kernel-assigned free port if occupied.
    # The recorded port belongs to this worktree and is reused by url/shoot.
    port=$(LAB_PREFERRED="$preferred" python3 - <<'PYPORT'
import os, socket
preferred = int(os.environ['LAB_PREFERRED'])
for candidate in (preferred, 0):
    with socket.socket() as sock:
        try:
            sock.bind(('127.0.0.1', candidate))
        except OSError:
            continue
        print(sock.getsockname()[1])
        break
PYPORT
)
    printf '%s\n' "$port" > "$portfile"
    url=https://127.0.0.1:$port
    PATH="$root/.tools/go/bin:$PATH" go build -o .cache/browser-host ./test/browser-host
    npm run build --prefix web
    # Detach only the lab child, not the calling shell; keep its output and PID.
    LAB_ROOT="$root" LAB_STATE="$state" LAB_PORT="$port" python3 - <<'PY'
import os, subprocess
root, state = os.environ['LAB_ROOT'], os.environ['LAB_STATE']
with open(os.path.join(state, 'host.log'), 'ab', buffering=0) as log:
    child = subprocess.Popen([root + '/.cache/browser-host', root + '/web/dist'],
        cwd=root, env={**os.environ, 'BROWSER_HOST_LAB': '1', 'BROWSER_HOST_PORT': os.environ['LAB_PORT']},
        stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT,
        start_new_session=True)
with open(os.path.join(state, 'host.pid'), 'w') as pid:
    pid.write(str(child.pid) + '\n')
PY
    # Readiness is a bounded HTTPS check; a dead child is not a successful start.
    for ((i=0; i<40; i++)); do
      if alive && curl --silent --fail --insecure "$url/healthz" >/dev/null; then echo "$url"; exit 0; fi
      if ! alive; then break; fi
      sleep 0.25
    done
    echo "lab did not start; see $state/host.log" >&2
    exit 1
    ;;
  stop)
    exec 9>"$state/lock"
    flock 9
    if alive; then
      pid=$(cat "$pidfile")
      kill "$pid"
      for ((i=0; i<40; i++)); do
        if ! kill -0 "$pid" 2>/dev/null; then break; fi
        sleep 0.25
      done
    fi
    rm -f "$pidfile"
    echo 'lab stopped'
    ;;
  status)
    if alive; then echo "running $url (pid $(cat "$pidfile"))"; else echo 'stopped'; fi
    ;;
  url) echo "$url" ;;
  *) echo 'usage: scripts/lab.sh start|stop|status|url' >&2; exit 2 ;;
esac
