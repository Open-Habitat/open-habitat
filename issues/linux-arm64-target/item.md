---
created: 2026-10-24
updated: 2026-10-24
type: feature
status: open
priority: normal
preparation: ready
lane: unlaned
collision: [release/manifest, internal/hostop]
---

# Ubuntu 24.04 arm64 as a supported installation target

## Description

Jari, 2026-10-24: install Open Habitat for himself and Kaisa on **birch** (Fleetrepo; Lima/VZ Ubuntu 24.04 **aarch64** guest on Cedar). The product supports only Ubuntu 24.04 amd64: `scripts/package-release.sh` refuses targets other than `linux-amd64`, `runtime/core/ubuntu-packages.json` declares `ubuntu-24.04-amd64`, `host plan` treats arm64 packages as unmet, and every runtime lock pins x86_64 archives (Node linux-x64, himalaya, gog, Python, uv, browser wheels). Jari: "Lisää käännökset tälle koneelle. Voit kääntää vaikka Birchlla."

Goal: Ubuntu 24.04 **arm64** becomes a supported installation target alongside amd64: the release builder produces a `linux-arm64` archive; every runtime profile (core, integrations, the profiles that installation selects) has an arm64 lock with pinned digests, licenses and SBOM entries from official upstream arm64 artifacts; Ubuntu package requirements gain the arm64 architecture; `host prepare|plan|apply` accept arm64; the cloud qualification or an equivalent proves an arm64 install (birch itself or a disposable arm64 VM; birch may be used for builds and tests via `ssh birch` as `infra/birch/AGENTS.md` in Fleetrepo describes, without touching its other workloads). Where an upstream lacks an official arm64 artifact, build it reproducibly from pinned source or report that profile as unavailable on arm64 (explicit absence, not a silent gap).

## Acceptance Criteria

- [ ] `linux-arm64` release archive built and verified by the same checks as amd64; runtime locks for both architectures; tests for target selection.
- [ ] An arm64 install passes `host plan` clean and the daemon startup validator (record where it ran).
- [ ] Review: independent `/llm-review` (release trust, pinned artifacts).
