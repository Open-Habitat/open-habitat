---
created: 2026-09-27
updated: 2026-09-27
type: bug
status: open
priority: high
lane: auth-incident
collision: [internal/nativegh/]
---

# Recognize pinned absolute gh credential helper

## Description

Pilot.6 Jari-authorized live login after Fleetrepo-installed official gh 2.46.0: Unix binding/account/private file and daemon active, callback handoff_failed. Bounded guest read-only probe of mapped UID (no credential output) found gh auth status exit 1 after cleanup, root-created config dirs and hosts.yml, git helper exists but differs from exact !gh auth git-credential string expected by nativegh.Adapter.observe and Disconnect. Compare to exact known command returned true for !/usr/bin/gh auth git-credential. Current Executor PATH=/usr/bin:/bin and native gh installed hash-pinned /usr/bin/gh. Recognize only the exact absolute pinned helper plus existing exact relative form if test fixtures require it; reject arbitrary path, shell interpolation, or suffix, do not broaden to substring matching. Add synthetic tests for both exact forms and malformed/lookalike helpers. Clean CI, focused security review, then live retest. No guest edits in worker. Never log tokens or host config contents.
