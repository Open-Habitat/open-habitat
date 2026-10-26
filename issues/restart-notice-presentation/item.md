---
created: 2026-10-26
updated: 2026-10-26
type: bug
reporter: jari
status: open
priority: normal
lane: unlaned
collision: [web/src/components/Conversation.tsx]
preparation: ready
---

# Restart notice appears as a raw English extension block and calls a live worker stalled

## Description

Jari, 2026-10-26, Birch pilot.12, first message after the upgrade restarted
his conductor conversation (Claude Code via Habitat; screenshot
`~/attachments/0af7fe63-16a3-4682-bcc2-54c2dc0b1c5f`): the restart notice that
Habitat prepends ("[Open Habitat] This conversation's Pi had stopped … Background
processes that were cut off … Spinoffs that settled …") is shown to him as a
"Laajennuksen viesti" card holding the raw English text in a monospace
scroll box. It is written for the agent, but the person sees it verbatim.

It also said run 01m5w60pxynq08hyrxde3s1dyn "stalled (its supervisor
stopped)", while its supervisor (pid alive) and Claude worker were running;
the worker was waiting at a Claude Code safety prompt. The claim was wrong.

Expected: the person sees a short Finnish, human-readable note (the
conversation was restarted; which waits were cut; which workers finished),
or nothing beyond a quiet marker, while the agent still gets the full text;
"stalled" is said only when Taskfleet itself reports it, not inferred.

## Acceptance Criteria

- [ ] Person-facing presentation of the restart notice; agent text unchanged
  in substance; run state taken from Taskfleet's own status; tests.

