---
created: 2026-10-01
updated: 2026-10-03
type: bug
reporter: agent
status: fixed
priority: normal
provenance: agent
provenance_detail: wrap-up-2026-10-01
lane: design-package
lane_seq: 1
closed: 2026-10-03
closed_by: claude
---

# Design package assembly fails when its cache directory is missing

## Description

`python3 .claude/skills/design-package/scripts/assemble.py --issue request-design-v2-review ...` failed with
`design-package: [Errno 18] Invalid cross-device link: '/tmp/design-package-…' -> '.cache/design-package/request-design-v2-review'`
when `.cache/design-package/` did not exist yet. The script stages in `tempfile.mkdtemp(dir=out.parent if out.parent.is_dir() else None)`, so a missing parent falls back to the system temp directory, which on alder is a different filesystem, and the final rename fails. Rerunning after the directory existed succeeded.

Expected: create the output parent before staging (or stage beside the output always), so the first run on a fresh checkout works; never stage in `/tmp`.

## Acceptance Criteria

- [x] A first run with a missing output parent stages both temporary artifacts beside the output and publishes the directory and zip; the focused test and clean gate pass.
