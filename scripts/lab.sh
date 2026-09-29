#!/usr/bin/env bash
# Disposable, loopback-only browser lab; never uses a real Pi or home.
set -euo pipefail
cd "$(dirname "$0")/.."
root=$PWD
state=$root/.cache/lab
pidfile=$state/host.pid
url=https://127.0.0.1:4175
mkdir -p "$state/shots" /var/tmp/native-agent-host-build
export TMPDIR=/var/tmp/native-agent-host-build
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
    PATH="$root/.tools/go/bin:$PATH" go build -o .cache/browser-host ./test/browser-host
    npm run build --prefix web
    # Detach only the lab child, not the calling shell; keep its output and PID.
    LAB_ROOT="$root" LAB_STATE="$state" python3 - <<'PY'
import os, subprocess
root, state = os.environ['LAB_ROOT'], os.environ['LAB_STATE']
with open(os.path.join(state, 'host.log'), 'ab', buffering=0) as log:
    child = subprocess.Popen([root + '/.cache/browser-host', root + '/web/dist'],
        cwd=root, env={**os.environ, 'BROWSER_HOST_LAB': '1'},
        stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT,
        start_new_session=True)
with open(os.path.join(state, 'host.pid'), 'w') as pid:
    pid.write(str(child.pid) + '\n')
PY
    # Readiness is a bounded HTTPS check; a dead child is not a successful start.
    for ((i=0; i<40; i++)); do
      if curl --silent --fail --insecure "$url/healthz" >/dev/null; then echo "$url"; exit 0; fi
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
