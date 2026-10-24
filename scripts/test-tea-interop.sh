#!/usr/bin/env bash
# Run the shared-login tests against a shipped tea: a built integrations
# profile's payload/runtime/bin/tea, never an installed one. The Habitat side
# is the nativegitea test binary, built here or passed in (cross-built with
# GOARCH for a host without Go, such as an arm64 builder).
#
#   test-tea-interop.sh TEA [NATIVEGITEA_TEST_BINARY]
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
[[ $# == 1 || $# == 2 ]] && [[ $1 == /* && -x $1 ]] || { echo 'usage: test-tea-interop.sh ABSOLUTE_TEA [NATIVEGITEA_TEST_BINARY]' >&2; exit 1; }
umask 077
work=$(mktemp -d /var/tmp/oh-tea-XXXX)
trap 'rm -rf "$work"' EXIT
test_binary=${2:-}
if [[ -z $test_binary ]]; then
  test_binary=$work/nativegitea.test
  (cd "$repo" && go test -c -o "$test_binary" ./internal/nativegitea)
fi
"$1" --version
TMPDIR=$work OH_TEA_BINARY=$1 "$test_binary" -test.run '^TestShippedTea' -test.count=1 -test.v
