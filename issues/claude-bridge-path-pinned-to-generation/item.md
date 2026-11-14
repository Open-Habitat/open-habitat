---
created: 2026-11-10
updated: 2026-11-14
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: observed by the web-search-native worker on Birch
source_ref: taskfleet:01m72sdb5txedt2x9p5rz4bsax/observed:bridge-settings-generation-path
originating_run: 01m72sdb5txedt2x9p5rz4bsax
originating_run_kind: spinoff
lane: claude-bridge-path
lane_seq: 1
preparation: ready
closed: 2026-11-14
---

# Claude model selection pins the bridge to one release generation in a person's Pi settings

## Description

Selecting a Claude model persists the bridge extension path resolved from the installed Pi entry in native settings. That entry names a release generation rather than the stable installation selector. After upgrades, standalone Pi continues using the old bridge; after that generation is pruned, it reports a missing extension.

Browser conversations and the Habitat terminal launcher explicitly load the current bridge, but native settings still need repair so standalone Pi works too.

## Acceptance Criteria

- [x] New Claude selections persist a generation-independent bridge path.
- [x] Reads repair old generation entries even when the old path no longer exists.
- [x] Unrelated extensions and model preferences survive repair.
- [x] Focused daemon tests and native Pi regression tests pass.

## Accepted scope

Use the installation's stable core bridge path for new selections and repair previously persisted generation paths on settings read or start. Preserve unrelated extensions and native model preferences. This is an approved defect fix, not an experimental feature.

## Resolution

### 2026-11-14T07:48:06Z · @issuectl

Fixed and validated; see result.md. Live check: real pinned Pi helper and standalone CLI passed with a synthetic installation and absent old generation; production deployment not performed.
