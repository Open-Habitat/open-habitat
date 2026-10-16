---
created: 2026-10-16
updated: 2026-10-16
type: bug
reporter: jari
status: open
priority: high
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
blocked_by: ['@proto-queued-send']
lane_seq: 1
---

# Composer colour and send arrow; slow 'Luodaan keskustelua' blocks typing; confusing notices in first conversation; new workspace gets an agent

Jari on the live test server, 2026-10-16 ~18:00 local:
1. **Composer colour.** The text field is white with one line; when it grows to two or more lines, its background turns grey. It must keep one background.
2. **Send button.** The arrow is not vertically centred in the round button; it sits towards the top.
3. **"Luodaan keskustelua" is far too long, and the field is disabled meanwhile.** While the conversation is being created, the field must stay enabled, so the person can type at once. Show no "Pi process starting" details. The first message is sent when Pi is ready, visibly queued, never lost and never sent twice.
4. **First conversation in an empty workspace** (`ensimmainen-keskustelu.png`): it shows "Tapahtumia jäi väliin · Live-tapahtumien häntä ei ole täydellinen. Tarkista natiivi historia." and "Spinoffien tilaa ei saada." Both are confusing and unnecessary in a fresh conversation. Show neither unless it is actionable and true.
5. **After "Luo työtila"**, the new workspace gets one agent conversation, and focus moves into it, so the person can type.

## Acceptance Criteria
- [ ] Each point is covered by a browser test, with paired lab screenshots (desktop and phone).

The sent-before-Pi-runs look is decided in `proto-queued-send` (Decisions): Kupla odottaa, messages joined into one prompt, Stop returns them to the field, no top-bar state. Round `design-system/prototypes/rounds/2026-10-16-jonolahetys/` direction 1 is the spec.
