---
created: 2026-10-31
updated: 2026-10-31
type: task
reporter: jari
status: open
priority: normal
lane: release-smaller-upload
lane_seq: 1
preparation: ready
---

# Release cut uploads only what changed (not 2.3 GB of unchanged runtime archives)

## Description

Jari 31.10.: uploading 2.3 GB per release over Alder's ISP is unacceptable. pilot.17 re-uploaded all twelve runtime archives byte-identical to pilot.16 (`issues/release-pilot-17/result.md`). Make a release reuse unchanged runtime archives instead of uploading them again, so a typical release uploads only the product archives (tens to a few hundred MB). The installer verifies assets by GitHub asset digests and the manifest (ADR 0034 step 2, Fleetrepo `stage-release.sh` / upgrade operator); the reuse must keep that verification exactly as strong: e.g. the manifest names the runtime archive by digest and the release where it lives (an immutable earlier release or a dedicated immutable runtime release), and the operator fetches and checks it there. If the right design changes the trust chain or needs a Fleetrepo operator change, design it, record it under Decisions for later review, make the product side, and file the Fleetrepo change as an issue in Fleetrepo with the exact need; do not weaken digest checks. Measure the upload size of a dry-run cut. Also consider uploading from Birch instead of Alder where signing is not involved.

## Comments
