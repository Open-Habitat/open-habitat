---
created: 2026-09-27
updated: 2026-09-27
type: bug
status: fixed
priority: high
lane: auth-incident
collision: [internal/nativegh/]
closed: 2026-09-27
closed_by: pi
---

# Recognize pinned absolute gh credential helper

## Description

Pilot.6 Jari-authorized live login after Fleetrepo-installed official gh 2.46.0: Unix binding/account/private file and daemon active, callback handoff_failed. Bounded guest read-only probe of mapped UID (no credential output) found gh auth status exit 1 after cleanup, root-created config dirs and hosts.yml, git helper exists but differs from exact !gh auth git-credential string expected by nativegh.Adapter.observe and Disconnect. Compare to exact known command returned true for !/usr/bin/gh auth git-credential. Current Executor PATH=/usr/bin:/bin and native gh installed hash-pinned /usr/bin/gh. Recognize only the exact absolute pinned helper plus existing exact relative form if test fixtures require it; reject arbitrary path, shell interpolation, or suffix, do not broaden to substring matching. Add synthetic tests for both exact forms and malformed/lookalike helpers. Clean CI, focused security review, then live retest. No guest edits in worker. Never log tokens or host config contents.

## Comments

### 2026-09-27T16:44:59Z · @pi

Synthetic verification: exact relative and /usr/bin/gh helper strings are accepted through observation, fresh install/reobservation, Git credential fill, and disconnect; alternate paths and shell suffixes are rejected before credential fill. The executor fixes PATH to /usr/bin:/bin; the absolute form relies on the root-installed, hash-approved binary at /usr/bin/gh. This change does not accept arbitrary helpers. Focused Go race test passed; full ./scripts/ci-local.sh --clean --json passed with TMPDIR=/var/tmp/t (disk-backed). No live retest or guest change was performed; @investigate-first-login remains open for that verification.
