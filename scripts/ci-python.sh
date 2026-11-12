# Sourced by entry scripts: the pinned Python from requirements-ci.txt.
#
# The contract validator and the Go tests that call it need jsonschema and
# referencing at the pinned versions; a host's system Python may lack them or
# carry others, and then schema tests fail for reasons unrelated to the change.

# oh_ci_venv DIR: create a venv at DIR with requirements-ci.txt installed.
oh_ci_venv(){
  python3 -m venv "$1"
  PIP_CACHE_DIR="$repo/.cache/ci-local/pip" "$1/bin/python" -m pip install --disable-pip-version-check --no-input --quiet -r "$repo/requirements-ci.txt"
}

# oh_ci_python VAR: store in VAR the interpreter of a shared, cached venv.
# Focused runs repeat often and worktrees come and go, so the venv lives
# under the git common directory, keyed by the requirements and the base
# interpreter; a changed pin or a Python upgrade gets a new one. It is built
# beside its final path and renamed into place, so concurrent runs never see a
# half-installed venv (the loser of a race discards its copy). Only bin/python
# is used, which stays valid after the rename, unlike pip's console scripts.
oh_ci_python(){
  local common base key final build
  common=$(git -C "$repo" rev-parse --path-format=absolute --git-common-dir) || return 1
  base=$(python3 -c 'import os,sys; print(os.path.realpath(sys.executable), sys.version)') || return 1
  key=$( { printf '%s\n' "$base"; cat "$repo/requirements-ci.txt"; } | sha256sum | cut -c1-16)
  final="$common/oh-ci-python/$key"
  if [[ ! -f $final/.complete ]]; then
    mkdir -p "$common/oh-ci-python"
    build=$(mktemp -d "$common/oh-ci-python/.build.XXXXXX")
    if ! oh_ci_venv "$build" || ! touch "$build/.complete"; then
      rm -rf "$build"
      echo "error: could not build the pinned Python venv from requirements-ci.txt" >&2
      return 1
    fi
    mv -T "$build" "$final" 2>/dev/null || rm -rf "$build"
  fi
  printf -v "$1" '%s' "$final/bin/python"
}
