---
created: 2026-10-21
updated: 2026-10-21
type: bug
reporter: jari
status: open
priority: high
lane: archive
lane_seq: 1
collision: [internal/daemon/archive]
---

# A conversation whose session file was cut by a full disk shows 'Historiaa ei saada' and cannot be archived

_Source: chat:quota-aftermath-2026-10-21_

## Description

Jari 2026-10-21: after the 2026-10-20 quota test the conversation 'Tee kotihakemistoon 100 Mt:n tes…' (workspace 4dcube-monorepo) shows only 'Historiaa ei saada', model 'Malli ei tiedossa', and archiving fails: 'Arkistointia ei tehty: Tila muuttui toisaalla. Päivitä tiedot ennen uutta yritystä. Keskustelu palautettiin listaan.'
Cause (verified on the test server): Pi's session file ~/.pi/agent/sessions/--home-maintainer-src-4dcube-monorepo--/2026-10-20T12-32-36-060Z_d64302e5-….jsonl was cut at exactly 32768 bytes by EDQUOT; its 8th (last) line is a partial JSON record (1726 bytes, no newline). Lines 1–7 are valid.
Jari's decision: accept that a full disk can leave the system in a broken state, but the product must be resilient so the person can get out of it: history shows what is readable (all complete records) with a plain note that the end of the conversation was cut off; archiving works for such a conversation (and other operations that only need to move or hide it); continuing it either works (Pi resumes from the last complete record, if Pi tolerates it) or the UI offers to continue in a new conversation. Never rewrite or truncate the person's native session file silently; if a repair is offered, it keeps a backup and is explicit.
Also fix the intermittent test race in mildly-itchy-top (archive test vs background idle check) if you touch the archive tests. Done: daemon tests with a truncated final line (history, archive, resume/new-conversation path), browser test of the cut-off note; Jari then archives the real broken conversation on the test server.
