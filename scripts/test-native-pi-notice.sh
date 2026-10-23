#!/usr/bin/env bash
# Real Pi + production CLI, in a disposable rootless container with synthetic HOME.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
export TMPDIR=/var/tmp
umask 077
out=$(mktemp -d /var/tmp/oh-notice.XXXXXX)
trap 'rm -rf "$out"' EXIT
chmod 755 "$out"
go build -o "$out/open-habitat" ./cmd/open-habitat
go test -c -o "$out/daemon.test" ./internal/daemon
chmod 755 "$out/open-habitat" "$out/daemon.test"
cp -a "$repo/internal/daemon/pi-device-test" "$out/pi-device-test"
chmod -R a+rX "$out/pi-device-test"
# Python is container PID 1: the production CLI still checks the socket creator
# is root/PID 1, and ServeAgent still checks its own nonroot UID on each peer.
podman run --rm --pull=never --network none \
  -v "$out:/fixture/bin:ro" \
  -v "$out/pi-device-test:/fixture/pi-device-test:ro" \
  -v "$(readlink -f "$(command -v node)"):/usr/bin/node:ro" \
  -w /fixture localhost/open-habitat-vm-tools:prereq /usr/bin/python3 -c '
import os, pathlib, socket, subprocess
assert os.getpid() == 1
os.umask(0o077)
# Match the live protected gateway configuration ancestor. Agent users must
# never need search access here merely to observe an upgrade deny marker.
private = pathlib.Path("/etc/open-habitat")
private.mkdir()
os.chown(private, 0, 21002)
private.chmod(0o750)
assert pathlib.Path("/proc/self/uid_map").read_text().split()[1] != "0"
with open("/etc/passwd", "a") as f:
    f.write("synthetic-agent:x:21001:21001::/nonexistent:/bin/sh\n")
p = pathlib.Path("/run/open-habitat/users/synthetic-agent")
p.mkdir(parents=True)
for d in [p, p.parent, p.parent.parent]: d.chmod(0o755)
selector = pathlib.Path("/opt/open-habitat/current")
selector.parent.mkdir(parents=True)
selector.parent.chmod(0o755)
selector.symlink_to("/fixture/bin")
s = socket.socket(socket.AF_UNIX)
s.bind(str(p / "agent.sock"))
os.chown(p / "agent.sock", 21001, 21001)
os.chmod(p / "agent.sock", 0o600)
s.listen(16)
def prepare():
    os.dup2(s.fileno(), 3)
    os.set_inheritable(3, True)
    os.setgroups([])
    os.setgid(21001)
    os.setuid(21001)
env = {"PATH":"/usr/bin:/bin", "HOME":"/nonexistent", "TMPDIR":"/var/tmp", "OH_NATIVE_NOTICE_CONTAINER":"1"}
fence = pathlib.Path("/opt/open-habitat/upgrade-closed")
stage = pathlib.Path(str(fence) + ".next")
for phase in ("open", "staged", "published", "reopened"):
    if phase == "staged": stage.write_text("closed\n")
    if phase == "published": stage.rename(fence)
    if phase == "reopened": fence.unlink()
    env["OH_NATIVE_NOTICE_FENCED"] = "1" if phase in ("staged", "published") else "0"
    print("notice fence phase:", phase, flush=True)
    r = subprocess.run(["/opt/open-habitat/current/daemon.test", "-test.run", "^TestNativePiNoticeOneToolCall$", "-test.v"], env=env, pass_fds=(s.fileno(),), preexec_fn=prepare)
    if r.returncode: raise SystemExit(r.returncode)
'
