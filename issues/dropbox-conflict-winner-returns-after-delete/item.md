---
created: 2026-11-22
updated: 2026-11-22
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: kokeiltavaa:2026-11-22/dropbox-conflict-winner-returns-after-delete
lane: unlaned
preparation: ready
---

# Dropbox: after a conflict, a locally deleted winning file comes back

## Description

Test server (pilot.853, 22.11.2026): testi-2.txt was edited in the cloud and locally; the next bisync correctly kept the cloud version under the name and the local as testi-2.habitat-2026-11-22-1.txt, both sides. When the folder was then deleted locally, the next pass deleted three files in the cloud but brought testi-2.txt back locally though it had been synced. A second local delete went through. Likely the bisync state does not record the conflict winner as synced, so the delete is read as delete-vs-change. Minor, but 'a file I deleted came back'. Related: bisync-conflict-renames-cloud-file.
