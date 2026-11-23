---
created: 2026-11-22
updated: 2026-11-23
type: improvement
reporter: conductor
status: open
priority: normal
provenance: chat
source_ref: conductor:2026-11-22:sharepoint-live
lane: unlaned
preparation: ready
---

# Microsoft files: an agent upload silently overwrites an existing file

## Description

Live check on a pilot installation's SharePoint test site (22.11.2026, full level, v0.1.5): every files write works through the account's relay — folder create, upload-file-content with the parent:/name: form, readback, a 3 MB create-upload-session upload, copy, rename, move, same-name refusal (409 with conflictBehavior fail on folder and upload session), delete. But upload-file-content to an existing path replaces the file without any question (the pinned server's own tip: 'Overwrites existing files without warning'), and it is not in microsoft-permission.mjs guardedTools. An agent can therefore replace a colleague's document in a shared library by mistake; SharePoint keeps versions, so it is recoverable, but nothing tells the person. Options: ask through the permission question when the target exists (read get-drive-item first, as deletes do), or default to conflictBehavior=fail and require an explicit replace. Decision needed from Jari.

## Decisions

### 2026-11-23T04:20:14Z · @jari

Jari 23.11.2026: yes, the agent asks before an upload replaces an existing file, through the same browser permission question as delete (read the target's metadata first; a new name does not ask).
