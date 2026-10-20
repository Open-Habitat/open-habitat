#!/usr/bin/env bash
set -euo pipefail
./node_modules/.bin/vite build
node demo/check-build.mjs "$@"
