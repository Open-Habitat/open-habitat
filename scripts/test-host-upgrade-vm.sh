#!/usr/bin/env bash
# Same isolated installation guest/runner; successor package is public test media.
set -euo pipefail
[[ $# == 4 ]] || { echo 'usage: test-host-upgrade-vm.sh PREDECESSOR_RELEASE TRUSTED_PUBLIC_KEY TRUSTED_VM_RUNNER SUCCESSOR_PACKAGE_WITH_RELEASE' >&2; exit 1; }
exec "$(dirname "$0")/test-host-apply-vm.sh" "$@"
