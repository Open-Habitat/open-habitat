#!/usr/bin/env bash
# Offline, disposable distinct-UID proof that a site default a person cannot
# read never reaches that person's UID or browser; never touches host gh or git.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
export TMPDIR=/var/tmp
mkdir -p "$repo/.cache"
CGO_ENABLED=0 go test -c -o "$repo/.cache/onboarding-defaults-uid.test" "$repo/internal/daemon"
podman run --rm --network none \
  -v "$repo/.cache/onboarding-defaults-uid.test:/opt/onboarding-defaults-uid.test:ro" \
  docker.io/library/ubuntu:24.04 \
  /bin/sh -ec '
    printf "agent-a:x:21001:21001::/home/agent-a:/bin/sh\nagent-b:x:21002:21002::/home/agent-b:/bin/sh\nfixture-gateway:x:21003:21003::/var/empty:/bin/sh\n" >>/etc/passwd
    printf "agent-a:x:21001:\nagent-b:x:21002:\nfixture-gateway:x:21003:\n" >>/etc/group
    cp /opt/onboarding-defaults-uid.test /var/tmp/onboarding-defaults-uid.test
    chmod 755 /var/tmp/onboarding-defaults-uid.test
    DEFAULTS_UID_CONTAINER=1 /var/tmp/onboarding-defaults-uid.test -test.run "^TestOnboardingDefaultsDistinctUIDs$" -test.v
  '
