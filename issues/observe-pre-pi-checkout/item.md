---
created: 2026-09-29
updated: 2026-09-29
type: task
status: done
priority: high
related: ['@pre-pi-github-clone']
lane: github-clone
collision: [internal/gateway/, internal/daemon/]
blocked_by: ['@pre-pi-github-clone']
closed: 2026-09-29
---

# Observe native checkout after uncertain onboarding clone

## Description

The new pre-Pi POST checkout correctly refuses duplicate names and returns checkout_uncertain on lost responses, but there is no pre-Pi read-only endpoint to verify whether a selected repo now exists in ~/src. Without one, the browser cannot recover an uncertain result or acknowledge an already-present matching checkout, especially for Jari’s existing repos; the Pi-gated snapshot cannot be used. Add a narrow authenticated per-UID GET observation for one exact selected owner/repo, with safe no-follow path inspection and verified git origin/checkout and explicit states absent, confirmed, conflict/partial, unavailable. GET must never create ~/src or call GitHub mutating APIs, and never expose filesystem paths or credentials. On confirmed match the first-use UI can proceed without duplicate clone; on absent it can allow explicit retry, on partial/conflict it must stop without auto delete/retry. Session/peer and bound subject as in POST; stringent request/response contract; separate-UID synthetic and browser host tests. Clean CI and evidence, no live account activity in worker; this is a prerequisite to a truthful one-button first-use flow.

## Comments

### 2026-09-29T05:56:14Z · @agent

Additional cross-UID proof at 7fe5103761f36bc406fc159feb96c33e0ed2d054: scripts/test-repo-catalog-uids.sh PASS (disposable networkless rootless container; two daemon kernel UIDs and separate gateway UID). Before native clone the GET reports absent; after clone it reports confirmed for the owner, forged identity receives 403 and foreign daemon UID cannot reach the socket. Full clean ./scripts/ci-local.sh --clean --json on this committed tree returned status passed, clean true; live host and credentials remain untested.

## Resolution

### 2026-09-29T05:56:14Z · @issuectl

Read-only native observation and distinct-UID synthetic check delivered; live account proof belongs to @github-repos-first-onboarding.
