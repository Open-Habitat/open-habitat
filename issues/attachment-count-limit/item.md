---
created: 2026-11-08
updated: 2026-11-08
type: improvement
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
---

# Allow 30 attachments per message instead of eight

## Description

Jari 8.11.2026: a message takes at most eight attachments, which is too tight;
he often has about twenty files. Raise the per-message count to 30 (the 20 MiB
per-file and 1 GiB attachments-directory limits stay), in the browser and in
the daemon/contract wherever the count is enforced, and say the limit in the
refusal text if it is still reached.
