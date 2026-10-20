---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: conductor
status: open
priority: normal
lane: integrations
lane_seq: 5
collision: [internal/daemon/integrations]
---

# One unknown key in integrations.json disables every integration

_Source: taskfleet:01m5ctfqbmah0hdkpnbfj0k5qm_

## Description

Observed 2026-10-20 on the test VM (pilot.249): the operator merged a google section into /opt/open-habitat/integrations.json before the Google-capable release was installed; the daemon rejected the whole file and the live catalogs lost IMAP and Dropbox availability until the key was withdrawn. An installation file shared by every user should degrade per entry: an unknown or invalid entry makes only that entry unavailable (with a logged reason), while valid entries stay available. Strict validation of known entries stays. Done: daemon test with an unknown provider key and a malformed known entry next to valid IMAP/Dropbox entries.
