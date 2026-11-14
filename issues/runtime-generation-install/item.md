---
created: 2026-11-13
updated: 2026-11-14
type: improvement
status: open
priority: normal
provenance: chat
source_ref: conductor:2026-11-13/runtime-generation-install
lane: runtime-release
lane_seq: 2
preparation: ready
---

# Publish a runtime generation without a full host apply

## Description

## Proposal

A supported way to publish a runtime generation without a full host apply, for example `runtime-release install --manifest-sha256 … --select core`, running stage, publication and the selector/link writes of `finishGeneration`. Hosts not (yet) installed by host apply would then not reimplement the generation layout and selector bytes.

Raised 13.11.2026 when our test installation moved to the release-bundled core runtime.
