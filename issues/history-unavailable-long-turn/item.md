---
created: 2026-11-12
updated: 2026-11-12
type: bug
reporter: jari
status: fixed
priority: high
provenance: chat
source_ref: chat:2026-11-12/history-unavailable-kaisa
lane: unlaned
preparation: ready
closed: 2026-11-12
closed_by: claude-worker
---

# History unavailable (503) during a long-running turn; card tells the person to contact the administrator

## Description

Jari 12.11.2026: Kaisa (Birch, her own account) got, under a turn whose
bash call had run 52 minutes ("Agentti työskentelee · Ajaa bash · 52:00"),
the card "Historiaa ei saada — Tarkistettu: historiaa ei vieläkään saada.
Mitään ei ole kadonnut; kerro ylläpitäjälle" with "Tarkista keskustelun tila".
It bothers her. Screenshot beside this issue.

Her daemon logs were not read (another person's account). The same symptom
exists in Jari's account: `GET /api/v1/agents/{id}/history` answered 503 in
~120 ms at 13:36:20 and 13:37:37 (+02:00) on 12.11. and at 09:36:21 on 11.11.;
the `http_request` event carries no reason code, so the cause cannot be read
from the journal.

To find: which native condition makes the history read refuse (session file
being appended by a long tool call, size/page limits, revision mismatch,
writer lease, compaction), whether the card is right to tell a person to
contact the administrator for it, and the fix. Log the refusal reason.

Kaisa suspects a limit was hit (Jari 12.11.). Candidates: the per-person
storage quota (a full quota cuts every write, including the session file the
history is read from) or the model provider's usage limit. Whatever the
limit, the person must get a meaningful message naming it, not "history
unavailable, tell the administrator".

## Resolution

### 2026-11-12T12:49:17Z · @claude-worker

Cause: the page reader refused any read during which Pi appended; fixed by reading the prefix seen at open. Quiet browser re-read, storage-cut card, refusal reason in the request log. See result.md.
