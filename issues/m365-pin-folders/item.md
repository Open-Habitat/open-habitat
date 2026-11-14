---
created: 2026-11-14
updated: 2026-11-14
type: feature
status: open
priority: normal
preparation: pending
lane: m365-connect
lane_seq: 2
---

# Pin Microsoft folders as local copies (separate feature, prototype first)

## Idea (Jari 14.11.2026)

With Microsoft files reached on demand (`m365-agent-file-search`) and the
connect dialog no longer choosing folders (`m365-connect-without-folder-choice`),
a person may still want some folders kept locally, not only in the cloud:
"pin" a folder so it stays as a local two-way copy (e.g. to work on it
offline-fast or with tools that need real files). A separate feature, to be
prototyped and thought through on its own: where pinning happens, what it
costs against the home quota (size shown at the moment of pinning), how
unpinning works, and how it relates to fetched files.
