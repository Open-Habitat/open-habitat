#!/usr/bin/env bash
# Read-only latency probe of the live test route: unauthenticated /healthz only,
# no session, no user data. Run from Alder. Prints per-request time to first byte
# for a warm (reused) connection through Cloudflare and through Alder's local SSH
# forward to the guest gateway, then the medians.
set -euo pipefail
n=${1:-20}
public=https://open-habitat-test.example.test/healthz
forward=https://127.0.0.1:18443/healthz   # Alder omega-forward -> guest 127.0.0.1:8443
probe() { # $1 url, $2 extra curl flag; one connection, n sequential requests
  local args=() ; for ((i=0; i<n; i++)); do args+=(-o /dev/null "$1"); done
  curl -s $2 -w '%{time_starttransfer}\n' "${args[@]}" | tail -n +2  # drop the cold first request
}
median() { sort -n | awk '{a[NR]=$1} END {print a[int((NR+1)/2)]}'; }
echo "public_warm_ttfb_s=$(probe "$public" "" | median)"
echo "forward_warm_ttfb_s=$(probe "$forward" -k | median)"
