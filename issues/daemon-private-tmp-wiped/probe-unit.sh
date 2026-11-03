#!/usr/bin/env bash
# Host proof for the daemon unit's temporary directories (run with sudo on
# an Ubuntu 24.04 / systemd 255 host). Starts transient system units with the
# exact [Service] sandbox directives of systemd/open-habitat-daemon@.service
# (ExecStart replaced by a probe, %i by the account, the state directory
# renamed so the real /var/lib/open-habitat-tmp is untouched), twice per
# account, as two accounts. Usage: probe-unit.sh OWNER OTHER PREFIX
set -euo pipefail
owner=$1 other=$2 prefix=$3
repo=$(cd "$(dirname "$0")/../.." && pwd)
props() {
  sed -n '/^\[Service\]/,/^\[/p' "$repo/systemd/open-habitat-daemon@.service" |
    grep -E '^[A-Za-z]+=' | grep -vE '^(ExecStart|Restart)=' |
    sed -e "s/^Group=%i$/Group=$(id -gn "$1")/" -e "s/%i/$1/g" -e "s#open-habitat-tmp#$prefix#g" |
    sed 's/^/-p\n/'
}
probe='echo "user=$(id -un)";
grep -E " /(var/)?tmp " /proc/self/mountinfo | cut -d" " -f4,5;
test -e /var/tmp/marker && echo var_tmp_marker=present || echo var_tmp_marker=absent;
test -e /tmp/marker && echo tmp_marker=present || echo tmp_marker=absent;
ls /var/lib/'"$prefix"'/'"$owner"' >/dev/null 2>&1 && echo owner_dir=readable || echo owner_dir=denied;
cat /var/lib/'"$prefix"'/'"$owner"'/marker >/dev/null 2>&1 && echo owner_marker=readable || echo owner_marker=denied;
echo x > /var/tmp/marker; echo x > /tmp/marker'
run() {
  mapfile -t p < <(props "$1")
  echo "== $1 run $2"
  systemd-run --wait --pipe --quiet --collect --unit="oh-tmp-probe-$1-$2" "${p[@]}" /bin/sh -c "$probe"
}
run "$owner" 1; run "$owner" 2; run "$other" 1
echo "== host view"
stat -c '%n %U:%G %a' "/var/lib/$prefix" "/var/lib/$prefix/$owner" "/var/lib/$prefix/$other"
