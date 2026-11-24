---
created: 2026-11-25
updated: 2026-11-25
type: chore
reporter: runtime-pin-watch
status: untriaged
priority: normal
labels: [runtime-pin-watch]
provenance: other
provenance_detail: runtime pin watch
source_ref: runtime-pin-watch:blocked@2026-11-24T20:04:18Z
---

# Runtime pin watch cannot publish its commits (since 2026-11-24 20:04 UTC)

## Description

The publication scanner blocks the push of the watch's own unpublished
commits. Nothing the watch files, researches or bumps reaches main until a
conductor resolves it: fix or accept the findings, or set the commits aside
with the watch's `recover` command. New bumps are held meanwhile.

- Since: 2026-11-24T20:04:18Z
- Last reason: findings in outgoing changes: email:runtime/profiles/integrations/gog-THIRD-PARTY-NOTICES

Filed by the runtime pin watch, once per stuck episode. Close it when the
watch publishes again.
