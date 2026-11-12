---
created: 2026-11-12
updated: 2026-11-12
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: taskfleet research run prototype (cloud write safety)
source_ref: taskfleet:01m77a7cnyqcfyft7ccrym0kpr/finding:bisync-conflict-renames-both
originating_run: 01m77a7cnyqcfyft7ccrym0kpr
originating_run_kind: research
lane: bisync-fixes
preparation: ready
lane_seq: 1
closed: 2026-11-12
commits:
- hash: 3b85cc45b
  summary: Keep the cloud file's name on a bisync conflict
---

# Sync conflicts rename both copies, so the colleague's SharePoint file loses its name (and Office extension)

## Description

## Observation (prototype on Birch, 12.11.2026, rclone v1.71.2)

Today's synced libraries use `--conflict-resolve none --conflict-loser num`.
When an agent edits `doc.txt` locally and a colleague edits it in the cloud
between passes, bisync renames **both** copies, on both sides:

    Path1  Renaming Path1 copy  - local/doc.txt.conflict1
    Path2  Renaming Path2 copy  - remote/doc.txt.conflict2

Afterwards neither side has `doc.txt`. Nothing is lost, but in SharePoint
the colleague's file has disappeared under its name: links, Teams tabs and
co-authoring sessions point to a name that no longer exists, and on the
OneDrive backend the rename moves the item, so its version history follows
`doc.txt.conflict2`. For Office files the suffix lands after the extension
(`Budget.docx.conflict2`), so the copy no longer opens by double-click in
Windows or SharePoint.

OneDrive's own client does the opposite: the cloud file keeps its name and
only the local copy is renamed with the device name
(`Budget-MyLaptop.docx`).

## Verified alternative

`--conflict-resolve path2 --conflict-loser num --conflict-suffix
<label> --suffix-keep-extension` (prototype, same rclone): the cloud copy
keeps `Budget.docx` on both sides in the same pass, and the agent's version
is uploaded next to it as `Budget.<label>1.docx`. (`--conflict-loser
pathname` left the local winner missing until the next pass in the same
test, so `num` is preferable.) The suffix accepts placeholders such as
`{DateOnly}`.

Jari's target (12.11.): about as safe as Microsoft's own tools, nothing
silently lost, nothing broken. Research context and the recommended suffix:
`issues/cloud-files-on-demand/research-write.md`.
