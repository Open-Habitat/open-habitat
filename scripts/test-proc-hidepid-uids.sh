#!/usr/bin/env bash
# Actual mapped UIDs under a private Ubuntu 24.04 PID/mount namespace. Never
# remount the developer host's procfs. SYS_ADMIN applies only inside the userns.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
export TMPDIR=/var/tmp
mkdir -p "$repo/.cache"
image=localhost/open-habitat-proc-uids:ubuntu-24.04
if ! podman image exists "$image"; then
  printf 'FROM docker.io/library/ubuntu:24.04\nRUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends systemd polkitd dbus procps && rm -rf /var/lib/apt/lists/*\n' |
    podman build -q -t "$image" -f - >/dev/null
fi
CGO_ENABLED=0 go test -c -o "$repo/.cache/proc-hidepid.test" "$repo/internal/daemon"
podman run --rm --network none --cap-add SYS_ADMIN --security-opt unmask=ALL \
  -v "$repo/.cache/proc-hidepid.test:/opt/proc-hidepid.test:ro" \
  -v "$repo/systemd:/opt/units:ro" \
  -v "$repo/sysusers.d/open-habitat.conf:/opt/open-habitat.conf:ro" \
  "$image" /bin/sh -ec '
    cp /opt/units/open-habitat-proc.service /etc/systemd/system/
    cp -a /opt/units/polkit.service.d /opt/units/systemd-logind.service.d /etc/systemd/system/
    systemd-analyze verify --man=no open-habitat-proc.service polkit.service systemd-logind.service
    systemd-sysusers /opt/open-habitat.conf
    # Match the dynamically allocated production exemption group with the
    # fixed synthetic group expected by the distinct-UID test.
    groupmod -g 21004 open-habitat-proc
    printf "agent-a:x:21001:21001::/nonexistent:/bin/sh\nagent-b:x:21002:21002::/nonexistent:/bin/sh\nobserver:x:21003:21003::/nonexistent:/bin/sh\n" >>/etc/passwd
    # The container runtime locks its proc mount. Overmount a new procfs first,
    # then exercise the shipped service command, including name-to-gid lookup.
    mount -t proc proc /proc
    command=$(sed -n "s/^ExecStart=//p" /opt/units/open-habitat-proc.service)
    $command
    grep " /proc " /proc/mounts | tail -1
    mkdir -p /run/dbus
    dbus-daemon --system --fork
    mkdir -p /usr/share/polkit-1/actions
    cat >/usr/share/polkit-1/actions/org.openhabitat.fixture.policy <<POLICY
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE policyconfig PUBLIC "-//freedesktop//DTD PolicyKit Policy Configuration 1.0//EN" "http://www.freedesktop.org/standards/PolicyKit/1/policyconfig.dtd">
<policyconfig><action id="org.openhabitat.fixture"><description>Synthetic process subject</description><message>Synthetic process subject</message><defaults><allow_any>yes</allow_any><allow_inactive>yes</allow_inactive><allow_active>yes</allow_active></defaults></action></policyconfig>
POLICY
    cp /opt/proc-hidepid.test /var/tmp/proc-hidepid.test
    chmod 755 /var/tmp/proc-hidepid.test
    PROC_POLKIT_UID=$(id -u polkitd) PROC_POLKIT_GID=$(id -g polkitd) \
      PROC_HIDEPID_UID_CONTAINER=1 /var/tmp/proc-hidepid.test \
      -test.run "^TestProcHidepidDistinctUIDs$" -test.v
    # Existing process tray and Taskfleet contracts, under the same mount.
    /var/tmp/proc-hidepid.test -test.run "^TestProcess(CommandHints|Socket|Notification|Waiting|ToolProjection|Taskfleet|UserSettings|Suppressed|RPCDelta|Unavailable|Snapshot|Interrupted)" -test.v
  '
