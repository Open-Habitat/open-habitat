#!/usr/bin/env bash
# Print a file that the tree no longer holds, as it was last committed.
#
#   scripts/from-history.sh [--archive REPOSITORY] <path-or-pattern> [--list]
#
# The argument is a repository path or a git pathspec glob, such as
# 'docs/decisions/adr-0019-*' or 'issues/repo-catalog-clone-jobs'. The newest
# commit that deleted a matching file is found; a single file is printed, and
# several (an issue directory) are listed with the command that prints each.
# A path that still exists is printed from the working tree. Exit 1 when no
# history matches. Fresh public history cannot retrieve private archive files;
# name the archive checkout explicitly with --archive (never searched implicitly).
set -euo pipefail

if [[ $# -lt 1 || $1 == -h || $1 == --help ]]; then
  sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi
if [[ $1 == --archive ]]; then
  [[ $# -ge 3 && -n $2 ]] || { echo 'from-history: --archive requires a repository and a path' >&2; exit 2; }
  cd -- "$2"
  shift 2
fi
cd "$(git rev-parse --show-toplevel)"
[[ $# -eq 1 || ( $# -eq 2 && $2 == --list ) ]] || { echo 'from-history: expected PATH [--list]' >&2; exit 2; }
spec=$1
[[ -n $spec && $spec != --* ]] || { echo 'from-history: expected a nonempty path' >&2; exit 2; }
list=false
[[ ${2:-} == --list ]] && list=true

if [[ -f $spec ]] && ! $list; then
  cat -- "$spec"
  exit 0
fi

sha=$(git log -1 --diff-filter=D --format=%H -- ":(glob)$spec" ":(glob)$spec/**" 2>/dev/null || true)
if [[ -z $sha ]]; then
  echo "from-history: no deleted file matches '$spec'" >&2
  exit 1
fi
mapfile -t files < <(git show --diff-filter=D --name-only --format= "$sha" -- ":(glob)$spec" ":(glob)$spec/**")
echo "# deleted in $(git log -1 --format='%h %ad %s' --date=short "$sha")" >&2
if [[ ${#files[@]} -eq 1 ]] && ! $list; then
  git show "$sha^:${files[0]}"
else
  for f in "${files[@]}"; do
    echo "git show $sha^:'$f'"
  done
fi
