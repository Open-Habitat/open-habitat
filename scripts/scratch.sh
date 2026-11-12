# Sourced by entry scripts: where their disposable scratch goes.
#
# /tmp is often a small tmpfs, so build caches, npm installs and test children
# belong on disk under /var/tmp. Nothing ages a directory placed directly in
# /var/tmp, though, and one killed run after another fills the filesystem. A
# host can therefore offer an expiring area for agent and build scratch:
# OH_SCRATCH_ROOT names it explicitly, and /var/tmp/agent-scratch is used when it
# exists and is writable. Such an area may carry a `.lease` file whose shared
# flock tells its retention job that entries are in use. A host without one
# falls back to /var/tmp, where only each script's own exit trap removes what
# it made.
#
# Keep the directory names short: Unix socket paths are limited to 108 bytes
# and tests put sockets under TMPDIR.

oh_scratch_root(){
  local root=${OH_SCRATCH_ROOT:-}
  if [[ -n $root ]]; then
    [[ $root == /* && -d $root && -w $root ]] || { echo "error: OH_SCRATCH_ROOT '$root' is not a writable absolute directory" >&2; return 1; }
  elif [[ -d /var/tmp/agent-scratch && -w /var/tmp/agent-scratch ]]; then
    root=/var/tmp/agent-scratch
  else
    root=/var/tmp
  fi
  printf '%s\n' "$root"
}

# oh_scratch_dir VAR PREFIX: create a new private directory under the scratch
# root and store its path in VAR. It is called directly, not in $(...), so that
# the root's shared lease (when it has one) stays held by this shell and its
# children. The caller removes the directory in its own EXIT trap, which bash
# also runs when a signal such as TERM ends it.
oh_scratch_dir(){
  local root
  root=$(oh_scratch_root) || return 1
  if [[ -z ${OH_SCRATCH_LEASE_FD-} && -f $root/.lease && -r $root/.lease ]] && command -v flock >/dev/null; then
    exec {OH_SCRATCH_LEASE_FD}<"$root/.lease"
    flock -s -w 60 "$OH_SCRATCH_LEASE_FD" || echo "warning: scratch lease $root/.lease busy; continuing without it" >&2
  fi
  printf -v "$1" '%s' "$(mktemp -d "$root/$2.XXXXXX")"
  [[ -n ${!1} ]]
}

# oh_short_scratch_dir VAR PREFIX: oh_scratch_dir for a TMPDIR that Go tests
# put Unix sockets under. t.TempDir(), a long test name and the socket file
# reach 85 bytes below TMPDIR, so TMPDIR itself may be at most 21 bytes. When
# the scratch root is too long for that, the directory goes directly into
# /var/tmp, where only the caller's EXIT trap removes it.
oh_short_scratch_dir(){
  local root
  root=$(oh_scratch_root) || return 1
  if (( ${#root} + ${#2} + 8 <= 21 )); then
    oh_scratch_dir "$1" "$2"
    return
  fi
  printf -v "$1" '%s' "$(mktemp -d "/var/tmp/$2.XXXXXX")"
  [[ -n ${!1} ]]
}
