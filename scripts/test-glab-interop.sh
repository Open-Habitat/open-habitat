#!/usr/bin/env bash
# Run the shared-login tests against a shipped glab: a built integrations
# profile's payload/runtime/bin/glab (or the verified release archive's
# bin/glab), never an installed one. The Habitat side is the nativegitlab
# test binary, built here or passed in (cross-built with GOARCH for a host
# without Go).
#
#   test-glab-interop.sh GLAB [NATIVEGITLAB_TEST_BINARY]
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
[[ $# == 1 || $# == 2 ]] && [[ $1 == /* && -x $1 ]] || { echo 'usage: test-glab-interop.sh ABSOLUTE_GLAB [NATIVEGITLAB_TEST_BINARY]' >&2; exit 1; }
umask 077
work=$(mktemp -d /var/tmp/oh-glab-XXXX)
trap 'rm -rf "$work"' EXIT
test_binary=${2:-}
if [[ -z $test_binary ]]; then
  test_binary=$work/nativegitlab.test
  (cd "$repo" && go test -c -o "$test_binary" ./internal/nativegitlab)
fi
"$1" --version
TMPDIR=$work OH_GLAB_BINARY=$1 "$test_binary" -test.run '^TestShippedGlab' -test.count=1 -test.v
