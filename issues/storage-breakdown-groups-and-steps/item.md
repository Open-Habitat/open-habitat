---
created: 2026-11-14
updated: 2026-11-14
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-14/storage-breakdown-groups-and-steps
lane: unlaned
lane_seq: 1
preparation: ready
---

# Storage breakdown hides cloud folders and history, shows trash three ways, asks twice

## Description

Jari 14.11.2026 (test server, experimental storage breakdown,
`storage-warning-no-breakdown`): the "Vapautettavissa" card showed only tool
caches (0.07 MiB) and the trash; everything else (11.47 GiB) was one grey
"Projektit ja muut tiedostot" bar. On disk behind it: the synced Dropbox
folder 7.2 GB, Habitat's offered files 0.85 GB, the synced OneDrive folder
0.7 GB, agent histories ~0.5 GB, workspaces 2.4 GB. The promised groups
(workspaces, history) did not appear and the cloud folders are not named
anywhere, so a person with a full quota would not see that most of it is a
synced cloud folder. Without the experiment the same bar is labelled
"Työtilat, agentin historia ja välimuistit 11,9 GiB", wrong when two thirds
are cloud folders.

Also: an empty trash shows three different values on the same page ("1 KiB"
in the legend, "0,04 MiB" in the breakdown, "Roskakori on tyhjä" in the trash
section). And the clean-up request had to be confirmed twice: the button
opened a dialog with the request in an editable field, and after confirming,
the same text opened again in the conversation's composer to send with
Enter. Jari: one step too many — either the dialog or a ready composer, not
both.

What worked: the 85 % mark, "Valinnan jälkeen alle varoitusrajan",
"Mittaa uudelleen", and the agent checking usage and removing only what was
asked.
