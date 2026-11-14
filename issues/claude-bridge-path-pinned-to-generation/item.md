---
created: 2026-11-10
updated: 2026-11-14
type: bug
status: open
priority: normal
provenance: other
provenance_detail: observed by the web-search-native worker on Birch
source_ref: taskfleet:01m72sdb5txedt2x9p5rz4bsax/observed:bridge-settings-generation-path
originating_run: 01m72sdb5txedt2x9p5rz4bsax
originating_run_kind: spinoff
lane: claude-bridge-path
lane_seq: 1
preparation: ready
---

# Claude model selection pins the bridge to one release generation in a person's Pi settings

## Description

Observed on Birch, 2026-11-10, in Jari's Habitat account: `~/.pi/agent/settings.json`
has `"extensions": ["/opt/open-habitat/generations/5a34f1cc…/payloads/core/runtime/node_modules/pi-claude-bridge/src/index.ts"]`,
while the installed generation is `9cc4df0c…` (`readlink -f /opt/open-habitat/current`).

Cause: `internal/daemon/pi_models_helper.mjs` (the `select` / `initialize-claude`
path, around `settings.setExtensionPaths([...paths, bridgePath])`) writes the
bridge path resolved from the Pi entry, which is the generation-specific path,
so that the native default also works over SSH. Every later upgrade leaves the
person's settings pointing at the generation that was current when they chose
a Claude model.

Effects:
- Browser conversations and the Habitat terminal's `pi` launcher load the
  current bridge first through `--extension` (CLI paths load before settings,
  and the first bridge instance registers the provider), so they are not
  affected today.
- A `pi` without the launcher (an SSH session running the person's own Pi)
  loads the old generation's bridge. Since `web-search-native`, the release's
  bridge is patched at build so Claude Code has WebSearch/WebFetch; an old
  generation's copy is not, so that person has no search on Claude over SSH,
  and keeps any other bridge fix only from the generation they selected in.
- If an old generation is ever removed, Pi reports a missing extension path at
  every start for that person.

Possible directions: write a generation-independent path
(`/opt/open-habitat/core/node_modules/pi-claude-bridge/src/index.ts`, which
follows `current`), and on the next selection or sign-in replace an earlier
`/opt/open-habitat/generations/*/…/pi-claude-bridge/src/index.ts` entry
instead of appending.
