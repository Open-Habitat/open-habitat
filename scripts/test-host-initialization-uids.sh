#!/usr/bin/env bash
# Root filesystem transactions and distinct-UID access denials in a disposable,
# networkless container. Not an installed/systemd/quota/activation acceptance run.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$repo/.cache"
export TMPDIR=/var/tmp
CGO_ENABLED=0 go test -c -o "$repo/.cache/host-installation.test" "$repo/internal/host"
CGO_ENABLED=0 go test -c -o "$repo/.cache/provision-installation.test" "$repo/internal/provision"
CGO_ENABLED=0 go test -c -o "$repo/.cache/bootguard.test" "$repo/internal/bootguard"
CGO_ENABLED=0 go test -c -o "$repo/.cache/cli-installation.test" "$repo/internal/cli"
# Child probes exec these bind-mounted binaries as a distinct kernel UID.
# Go preserves umask on a new output, so make that access explicit even at 077.
chmod 0755 "$repo/.cache/host-installation.test" "$repo/.cache/provision-installation.test" "$repo/.cache/cli-installation.test"
podman run --rm --network none \
  -v "$repo/.cache/host-installation.test:/opt/host-installation.test:ro" \
  -v "$repo/.cache/provision-installation.test:/opt/provision-installation.test:ro" \
  -v "$repo/.cache/cli-installation.test:/opt/cli-installation.test:ro" \
  -v "$repo/.cache/bootguard.test:/opt/bootguard.test:ro" \
  -v "$repo/site/example.json:/opt/example-site.json:ro" \
  docker.io/library/ubuntu:24.04 \
  /bin/sh -ec '
    mkdir -p /site
    cp /opt/example-site.json /site/example.json
    cd /root
    /opt/bootguard.test -test.v
    HOST_INIT_UID_CONTAINER=1 /opt/host-installation.test -test.run "^Test(Release.*|Upgrade.*|Operation(DistinctUIDs|LockAndInterruptedPhase|IncompleteAtomicWrite|InterruptedBeginDoesNotCreateReceipts|SplitPublicationAtEveryPhase)|Apply.*|Gateway.*|Prepare.*|Inspection.*|HomeObservation.*|Storage.*|PlanAdmission.*|ReferenceCodes.*)$" -test.v
    HOST_INIT_UID_CONTAINER=1 /opt/cli-installation.test -test.run "^TestHost" -test.v
    /opt/provision-installation.test -test.run "^Test(Initialize|PublishAdmission|CompleteOnly|CompleteAdmission)" -test.v
  '
# A server with a separate /var (birch's layout): /var/lib/open-habitat is its
# own filesystem, so generations must stage and publish within /opt.
podman run --rm --network none \
  --mount type=tmpfs,destination=/var/lib/open-habitat,tmpfs-mode=0755 \
  -v "$repo/.cache/host-installation.test:/opt/host-installation.test:ro" \
  docker.io/library/ubuntu:24.04 \
  /bin/sh -ec 'HOST_SPLIT_VAR_CONTAINER=1 /opt/host-installation.test -test.run "^TestGenerationStagingWithSeparateVar$" -test.v'
