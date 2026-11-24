---
created: 2026-11-23
updated: 2026-11-24
type: chore
reporter: runtime-pin-watch
status: done
priority: normal
labels: [runtime-pin-watch]
provenance: other
provenance_detail: runtime pin watch
source_ref: runtime-pin-watch:blocked@2026-11-23T12:56:09Z
closed: 2026-11-24
---

# Runtime pin watch cannot publish its commits (since 2026-11-23 12:56 UTC)

## Description

The publication scanner blocks the push of the watch's own unpublished
commits. Nothing the watch files, researches or bumps reaches main until a
conductor resolves it: fix or accept the findings, or set the commits aside
with the watch's `recover` command. New bumps are held meanwhile.

- Since: 2026-11-23T12:56:09Z
- Last reason: findings in outgoing changes: email:runtime/profiles/integrations/tailscale-THIRD-PARTY-NOTICES, email:runtime/profiles/integrations/tailscaled-THIRD-PARTY-NOTICES

Filed by the runtime pin watch, once per stuck episode. Close it when the
watch publishes again.
