---
created: 2026-10-24
updated: 2026-10-24
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: onboarding
lane_seq: 4
collision: [web/src/app/GitHubOnboarding]
---

# Onboarding AI step: misaligned buttons; implement the 'Ehdotus ja lista' layout

## Description

Jari 2026-10-24 on the Northwind pilot (pilot.7) and earlier in prototype round 3 (screenshots `pilot-ai-step.png`, and `issues/proto-admin-server-onboarding/r3-jari-ai-step.png`): in the onboarding AI step the Claude option's buttons are misplaced. "Kirjaudu Claudeen" sticks to the button below it and sits on the right instead of the left edge; the status "Claude-kirjautumista ei ole vahvistettu." floats right; "Takaisin valitsemaan GitHub-repoja" is huge and should sit e.g. next to "Keskeytä käyttöönotto ja kirjaudu ulos". Cause (round 4 analysis): `ClaudeSignIn` and `PiCredentials` use the Settings page `.s-row` grid (title left, status and button right), which wraps badly in the onboarding card.

Jari approved the AI-step layout **"Ehdotus ja lista"** (round 4 direction 1, `design-system/prototypes/rounds/2026-10-23-palvelin-aloitus-4/`): one heading for the step, every element left-aligned in one column, options as rows of one list where the chosen row opens in place with its sign-in or key field inside, the three API keys (OpenAI, Anthropic, DeepSeek) as compact one-line rows, clone progress on the route's Repot row (not in the card), the back action small and beside the cancel action. Implement that layout in production now with the options offered to everyone (site-configured defaults come later with the onboarding configuration).

## Acceptance Criteria

- [ ] Production AI step uses the 'Ehdotus ja lista' layout with production sign-in components restructured as round 4 proposed (step owns the heading; `PiDeviceSignIn`, `ClaudeSignIn`, `PiCredentials` embedded without their own headings; clone progress on the route); back action beside cancel; Settings › AI-tilit unchanged; browser tests for each option opening; screenshots desktop/390 px light/dark.
