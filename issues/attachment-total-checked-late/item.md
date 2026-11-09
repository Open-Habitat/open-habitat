---
created: 2026-11-09
updated: 2026-11-09
type: bug
reporter: jari
status: open
priority: high
lane: unlaned
preparation: ready
---

# Combined attachment size is checked only at send, after every file uploaded

## Description

Jari 9.11.2026, pilot.23 (screenshot `evidence/`): he attached ten large
images; all ten uploaded into the field, and only pressing Lähetä said
*Viestiä ei lähetetty · 10 liitettä ovat yhteensä 162 Mt, ja yhteen viestiin
mahtuu 100 Mt.* The combined limit should be noticed while attaching: as
soon as the attachments in the field exceed 100 MB (or 30 files), say so
right away with the same warning, mark which files go over, and keep Lähetä
from sending until it fits; a file whose addition would cross the limit
need not be uploaded at all. Keep `large-content-graceful`'s wording and the
draft-safe behaviour. The look of refusals is `proto-attachment-refusal`'s;
progress is `proto-attachment-upload-progress`'s.

## Acceptance Criteria

- [ ] Crossing 100 MB or 30 files while attaching shows the warning at once; Lähetä waits until it fits; removing files clears it.
- [ ] Test covering it; attachment specs green.
