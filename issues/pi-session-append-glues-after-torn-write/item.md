---
created: 2026-11-17
updated: 2026-11-17
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: agent code reading during taskfleet run
source_ref: taskfleet:01m7m12vygxrp6v70tppg57xqv/pi-session-append-newline-guard
originating_run: 01m7m12vygxrp6v70tppg57xqv
originating_run_kind: spinoff
---

# Pi's live session appender glues the next entry onto a torn line after a failed write

## Description

## Description

Pi's session appender (pinned `@earendil-works/pi-coding-agent` 1.5.2,
`SessionManager._persist`) writes each entry with
`appendFileSync(file, JSON.stringify(entry) + "\n")` and does not check
whether the file already ends in a newline. When a write is cut short in a
live Pi process (ENOSPC/EDQUOT part-way through an entry, so the file ends in
a partial JSON line), `_appendEntry` rolls the entry back in memory and
rethrows, but the next successful append in the same process lands straight
after the partial bytes. That glues a complete entry onto the torn one and
leaves a newline-terminated line that does not parse.

Pi's loader then skips that line, so the complete entry is lost from the
conversation. Habitat's daemon treats a complete unparseable interior line as
`history_damaged` and refuses to start Pi. An earlier fix covers only a
partial **final** line, which it truncates on resume. Pi's own
`loadEntriesFromFile` adds a newline only at load time, not between appends
in a running process.

The same gap in Claude Code's transcript writer broke every turn of
claude-bridge conversations (the companion now sets such a transcript aside).
For Pi's session it needs a fix upstream: before appending, start on a fresh
line when the file's last byte is not `\n`. Habitat could also guard this
around Pi, for example in the companion after a failed write.

## Reproduction (synthetic)

1. Start a Pi session in a directory on a small tmpfs or quota-limited
   filesystem; send messages until a write fails with ENOSPC mid-entry.
2. Free space; send another message in the same Pi process.
3. The session file now has a line `<partial entry><complete entry>\n`.
   Restart: the daemon reports `history_damaged`.

Found while fixing claude-bridge-torn-transcript-on-full-disk (code reading
of the pinned Pi, not yet observed live).
