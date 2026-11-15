---
created: 2026-11-15
updated: 2026-11-15
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-11-15/file-offer-dot-path-unexplained
lane: unlaned
lane_seq: 1
preparation: ready
closed: 2026-11-15
---

# File offer refuses a path under a dot directory without saying why

## Description

Agent test 15.11.2026 (test server): `open-habitat agent file offer --source
.pi/skills/test-guide/SKILL.md` answered `unsafe_file_source` and "daemon
refused personal operation; inspect input and native state", although the
file is an ordinary 0600 file in the person's own workspace (no symlink).
The same file copied to `offers/SKILL.md` was accepted. Apparently a path
component starting with a dot is refused; if that is intentional, the error
must say so (and the agent instructions mention it), otherwise the agent
guesses.
