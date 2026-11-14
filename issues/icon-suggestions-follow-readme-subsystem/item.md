---
created: 2026-11-14
updated: 2026-11-14
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-11-14/icon-suggest-subsystem
lane: unlaned
lane_seq: 1
collision: [internal/daemon/icon-helper.mjs]
preparation: ready
closed: 2026-11-14
---

# Workspace icon suggestions follow a subsystem the README mentions, not the workspace

## Description

Observed on the test server (14.11.2026): the icon suggestions for a monorepo
workspace (a company's data and tooling monorepo)
were all about bookkeeping ("Kirjanpidon selkeä tunnus", "Laskenta ja
talousdata") and offered the letter "A" as "Aggountantin alkukirjain". It
looked as if another repository's suggestions were shown.

Cause (conductor's reading): not a wrong repository. The suggester reads the
first 2 KiB of the README (`internal/daemon/workspace_icon_suggest_linux.go`,
`maxIconReadme`). This README's title and first line describe the workspace
(a one-line "Monorepo for <company> — data + tooling" description), but most of the prefix is about one subdirectory: the
bookkeeping home of an accounting tool called `aggountant`. The model in
`internal/daemon/icon-helper.mjs` weighs all README text equally, so a
subsystem named in a later section drives the suggestions, including letters
from a name that is not the workspace's.

Expected: the suggestions are about the workspace itself: its name and the
README's title and first paragraph lead; later sections only add colour.
Letter icons come from the workspace's own name (or the README title's
subject), never from a tool, directory or dependency the README mentions.
