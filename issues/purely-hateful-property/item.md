---
created: 2026-11-07
updated: 2026-11-07
type: bug
status: untriaged
priority: high
provenance: other
provenance_detail: observed named-release installation failure on Birch
source_ref: taskfleet:01m6v8x5ae9asbnt52h6rcnqa9/upgrade-predecessor-closure
originating_run: 01m6v8x5ae9asbnt52h6rcnqa9
originating_run_kind: spinoff
---

# pilot.20 rejects authentic pilot.19 predecessor closure before upgrade preview

## Description

## Observed failure

The digest-verified, immutable, gated v0.1.0-pilot.20 linux-arm64 release cannot preview the named upgrade from the authentic serving pilot.19 on Birch. `host upgrade --site /etc/open-habitat/site.json --dry-run --json` returns `host_observation_unavailable`, with an entirely empty plan. No bootstrap staging invocation or owner activation was made; the serving installation stays pilot.19.

Program origin: 01m6v8prd91cdpvh69s3awcb69; diagnostic worker: 01m6v8x5ae9asbnt52h6rcnqa9. Alder private evidence: `/var/tmp/agent-keep/birch-v0.1.0-pilot.20/01m6v8prd91cdpvh69s3awcb69/`. Root-only target predecessor copies: `/root/oh-v0.1.0-pilot.20-01m6v8prd91cdpvh69s3awcb69/predecessor/`.

## Reproduction and cause

Predecessor manifest SHA-256: `d77b0cebc62489ad9d17ce08be26f7ec29a479dfeb94e258b6213d939d4d1c98`. Successor: `ae557289da6a31dce69f946c9e6f60fab3f53e591b7510d380515b69c83d1786`.

Run `bin/runtime-release verify --directory PREDECESSOR_RELEASE --version 0.1.0-pilot.19 --manifest-sha256 d77b0cebc62489ad9d17ce08be26f7ec29a479dfeb94e258b6213d939d4d1c98` from both installed release packages against exactly the same saved, complete predecessor directory:

- pilot.19: exit 0, `status: verified`.
- pilot.20: exit 1, `runtime_release_failed: invalid_release: expected authenticated release manifest version 2` (the manifest already is schema 2).

Source at release commit 9d3a5ca1802497132e1f0db4716e77d93ce26572: `validRuntimeClosure` now unconditionally requires `validCoreAgentTools`, including pinned Taskfleet/workmux and agent launcher, for every core manifest. `BuildUpgradePlan` calls `installedRelease` -> `authenticateReleaseFile` -> `AuthenticateRelease` -> `validRelease` on the predecessor too. The pilot.19 core closure legitimately has no such newly introduced tools. A file-only strace ends after reading the predecessor generation's release.json, before product.json/generation observation, consistent with that parse rejection. Successor host check authenticates the target and reports `runtime.taskfleet: pass / taskfleet_runtime_planned`; the target itself is not missing those bytes.

## Recovery and permanent correction

No released executable/manifest was patched, and no authentication guard, security boundary, journal, fence or selector was bypassed. Since no owner was invoked, the operator restores only staged release inputs and site.json from complete root-only predecessor copies, retaining overwritten successor inputs separately. No service interruption or reboot is needed. Recovery verification is recorded in Fleetrepo `infra/habitat-birch/pilot20-result.md`.

A corrected published release must distinguish authenticated predecessor closure validation from successor-only feature requirements, preserving all digest/inventory authentication. Add a real pilot.19 -> new Taskfleet-bearing core upgrade regression, not just synthetic manifests with current mandatory fields. Also return a useful typed predecessor-manifest rejection instead of a generic host observation error. This issue remains open/untriaged after recovery; pilot.20 was not installed.
