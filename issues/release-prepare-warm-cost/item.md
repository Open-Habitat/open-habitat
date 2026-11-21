---
created: 2026-11-21
updated: 2026-11-21
type: improvement
status: open
priority: normal
provenance: other
source_ref: taskfleet:01m7zdezyyd3d4t7fskf7gzmvw/remaining-warm-release-cost
originating_run: 01m7zdezyyd3d4t7fskf7gzmvw
originating_run_kind: spinoff
lane: release-runtime
lane_seq: 2
preparation: ready
---

# Cache unchanged release preparation inputs and measure remaining warm-update cost

## Description

## Observed remaining cost

After the runtime payload-store changes fd211456 and 55adcee8, an unchanged-runtime successor at b01f4299 took 162.867 s end to end: preparation 28.500 s, deployment 127.018 s (nested, not additive). Deployment included a separate all-profile archive verification of 36.173 s, product archive transfer/readback 16.681 s, inert staging 6.306 s, switch 32.411 s and final acceptance 11.104 s. Switch substeps were stop 1.165 s, runtime publication/selection/attestation 10.367 s, start 14.283 s; its remaining 6.596 s was wrapper/unit/selector work. These are operator measurements, not isolated product benchmarks.

An operator-side optimization now being prepared reuses all-profile archive verification only when the verifier binary and complete manifest bytes other than the strictly validated release identity are unchanged, while rehashing every compressed archive and keeping fresh product staging and selected-tree checks. Even removing the entire 36.173 s step for free would leave 126.694 s. The 100 s target remains unmet; moving work outside downtime or raising the limit does not solve it.

## Product-owned work still repeated

At b01f4299, scripts/prepare-release.sh always performs npm ci and a fresh production web build, then scripts/package-release.sh builds the main binary, runtime-release, MCP relay and a second native main binary for skill printing. The retained build log reports npm dependency installation at about 4 s and Vite at 1.69 s. Git, Go, packaging, archive verification and runtime-manifest creation share the remaining preparation time; the log does not time them separately.

The runtime archive cache already exists. A caller cannot safely cache web or helper-binary inputs by pretending npm/go ran, copying stale ignored node_modules, or bypassing the canonical preparer. Cache ownership belongs with the product's build-input contract.

## Requested outcome

Instrument preparation subphases and expose a product-owned cache for unchanged production web and helper-binary inputs. Include source, lockfile, relevant build scripts/configuration, environment and toolchain identities in cache validity; authenticate cached outputs, rebuild on changes or corruption, and preserve exact new version/commit identity, gate/provenance checks, fixture rejection and final archive verification. Reuse Go's build cache rather than inventing an unsafe cache for identity-bearing final binaries.

Measure what remains in packaging and product startup/publication after that change; do not promise that the roughly 6 s npm/Vite saving alone closes a gap exceeding 26 s. Report full warm-update and changed-runtime results separately, including transfer and operator overhead, against the unchanged 100 s goal.

Related predecessor: @runtime-republished-every-release. This is the remaining preparation/profile work, not a request to redo the payload store. No live deployment was performed for this report.
