---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: open
priority: normal
preparation: ready
lane: unlaned
collision: [web/src/components/EditorReplaceNote]
---

# Korvasit agentin muutoksia note stays open; Kerro agentille should send at once; add close

## Description

Jari, 2026-10-24, trying concurrent editing (Rivimerkit, `editor-concurrent-edit-rivimerkit`) on the test server: "Rinnakkainen muokkaus toimii." One problem with the *Korvasit agentin muutoksia* note in the conversation (`web/src/components/EditorReplaceNote.tsx`):

1. It stays open all the time, even after pressing *Kerro agentille*.
2. *Kerro agentille* should send the message automatically (today it apparently prefills it). The message should be more concise; the agent can re-read the file itself when needed (e.g. "Tallensin tiedoston <path> ja korvasin samalla muutoksesi. Lue tiedosto uudelleen ennen kuin jatkat." — exact wording is the worker's call, short).
3. The note needs an × close button.

After sending, the note closes (or turns into a short confirmation that disappears). Sending follows the conversation's normal send path and its busy/queued rules; if the agent is mid-turn, use what the composer does today for a message sent during a turn.

## Acceptance Criteria

- [ ] *Kerro agentille* sends the concise message once and closes the note; × closes it without sending; the note does not reappear for the same save (tests + browser spec).
- [ ] KOKEILTAVAA.md Rivimerkit line updated.
