---
created: 2026-10-01
updated: 2026-10-01
type: bug
reporter: agent
status: open
priority: normal
provenance: agent
provenance_detail: wrap-up-2026-10-01
lane: unlaned
---

# Design package assembly fails when its cache directory is missing

## Description

`python3 .claude/skills/design-package/scripts/assemble.py --issue request-design-v2-review ...` failed with
`design-package: [Errno 18] Invalid cross-device link: '/tmp/design-package-…' -> '.cache/design-package/request-design-v2-review'`
when `.cache/design-package/` did not exist yet. The script stages in `tempfile.mkdtemp(dir=out.parent if out.parent.is_dir() else None)`, so a missing parent falls back to the system temp directory, which on alder is a different filesystem, and the final rename fails. Rerunning after the directory existed succeeded.

Expected: create the output parent before staging (or stage beside the output always), so the first run on a fresh checkout works; never stage in `/tmp`.
