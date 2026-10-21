---
created: 2026-10-21
updated: 2026-10-21
type: bug
reporter: jari
status: open
priority: normal
lane: local-files
lane_seq: 2
related: ['@implement-folder-attachments']
collision: [internal/daemon/pi-launch]
preparation: ready
size: M
---

# Shared own-computer folder is not available to the agent (local_files tool missing)

## Description

Jari 2026-10-21 on the test server (version 6992efc6, which moved folder access into Liitä and Integraatiot), on his Mac browser: shared a subfolder under Downloads (Northwind-Finnvera-paketti-2026-10-07); the UI showed it as shared. Asked 'Mitä finverapaktti kansiossa on?'. The agent searched the server home with find, then said it can read the own-computer folder only with the local_files tool and that the tool is not available in this conversation, suggesting a new conversation. Determine why local_files was not offered or usable to Pi in this conversation (registration at launch vs folder shared after the conversation started, the new attachment/integration state not reaching the bridge, the existing conversation predating the update, etc.), fix the cause, and verify end to end in the lab with a folder shared after the conversation started. Screenshot: /var/tmp/oh-shots/local-folder-unavailable.png on Alder.
