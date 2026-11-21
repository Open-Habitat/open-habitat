---
created: 2026-11-15
updated: 2026-11-21
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-15/rewind-all-changes
lane: rewind-all-changes
lane_seq: 1
preparation: ready
---

# Rewind restores only edit-tool changes; shell and script edits are not tracked

## Description

Jari 15.11.2026: the Palaa tähän (rewind) feature restores only changes made
with Pi's edit and write tools. Changes made any other way in the
conversation — a shell command, a script, `sed -i`, a formatter, a build
that rewrites files, `git checkout` — are not tracked at all, so returning
to an earlier message silently leaves them in place.

This needs thinking through or prototyping: what is the right way for a
conversation's file changes to be captured so that returning to a message
restores what the agent changed, whatever tool it used — and what the person
is told about changes it cannot restore.

Today: a Pi extension (better-pi-rewind's, `internal/daemon/rewind_linux.go`,
`rewind-extension.mjs`) copies the files the edit and write tools touch
before they change; bash tool calls are only listed.

## Decisions

### 2026-11-15T17:52:57Z · @jari

Jari 15.11.2026: sent the snapshot proposal to the maintainer of better-pi-rewind; he would prefer the model to live in that extension upstream so it is maintained there. Wait for the reply before building phase 1 in the product.

### 2026-11-21T07:47:50Z · @jari

Jari 21.11.2026: Palaa tähän restores only files the agent changed (option b). Ignored files are not touched. Git state: never written (7.11. decision stands). Folders that are not Git repositories: no such functionality (snapshots only for Git workspaces).
