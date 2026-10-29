---
created: 2026-10-29
updated: 2026-10-29
type: bug
reporter: jari
status: open
priority: normal
lane: session-robustness
lane_seq: 1
preparation: ready
---

# A partial last session line locks the conversation with no explanation

_Source: chat_

## Description

29.10. 21:18 Birch: Jari's account hit its 64 GiB quota while Pi was writing a thinking entry to the conductor conversation's session file; the write stopped mid-line and the file ended in a partial JSON line. After Habitat's idle stop (21:29) the wake was refused because the daemon rejected the broken history, shown in the browser only as `start_failed` / `unproven` with no reason. Another agent removed the one partial line by hand (original kept at `/var/tmp/agent-keep/pi-session-63f45868-truncated-line/` on Birch) and the conversation woke. The quota was filled mainly by a 20 GiB Go build cache and gate worktrees.

## Acceptance Criteria

- [ ] A partial last line of a Pi session file (crash or ENOSPC/EDQUOT mid-write) does not lock the conversation: the daemon ignores or quarantines exactly that trailing partial line when it is not newline-terminated (never a complete corrupt line in the middle), records it, and starts Pi; or, where it cannot, the browser says plainly that the history is damaged and what to do.
- [ ] start_failed reasons reach the browser in words.
- [ ] Tests with a truncated tail and with EDQUOT simulated.
