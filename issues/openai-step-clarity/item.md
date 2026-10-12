---
created: 2026-10-12
updated: 2026-10-12
type: bug
status: open
priority: normal
lane: signin-fix
lane_seq: 5
collision: [web/]
---

# OpenAI onboarding step flashes an error and buries its status

During Jari's first sign-in on pilot.22 (open-habitat-test) on 2026-10-12,
the OpenAI onboarding step briefly showed a red error notice after clicking
"Aloita kirjautuminen", before showing the device code. The exact wording
was not captured ("ei onnistu" or similar). Sign-in ultimately succeeded:
the daemon logged `pi_device_start accepted` at 11:20:27 UTC and Pi auth
was stored. The cause of the flash is not yet established.

Near the end, the notice that the page updates automatically was easy to
miss among the surrounding text. The person needs to see what to do now
and understand when they can simply wait.

The intended result is a calm, readable sign-in flow: preparing the code
looks like waiting, genuine failures remain recognizable, and the code,
verification link and automatic continuation are prominent when needed.
Secondary explanation should not compete with those essentials. This follows
the onboarding intent in [design-system/design.md](../../design-system/design.md).

The synthetic lab's fake Pi device flow provides a repeatable way to examine
the transition; [TESTING.md](../../TESTING.md) describes the lab and its limits.
Validation should demonstrate the successful transition without a misleading
error flash and show that the instructions and status are easy to find on
desktop and phone. Captures help assess readability; transition evidence is
needed for the brief flash.
