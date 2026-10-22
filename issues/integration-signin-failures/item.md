---
created: 2026-10-22
updated: 2026-10-22
type: bug
reporter: jari
status: fixed
priority: normal
lane: integrations
lane_seq: 1
collision: [web/integrations]
preparation: ready
closed: 2026-10-22
---

# Microsoft sign-in ends in 'Kirjautuminen ei onnistunut' and Dropbox hangs at 'Viimeistellään kirjautumista'

## Description

Jari 2026-10-22 on the test server: (1) Microsoft 365: the Microsoft side went fine, but the dialog ended in 'Kirjautuminen ei onnistunut. Mitään ei yhdistetty.' Twice, same result (screenshot /var/tmp/oh-shots/microsoft.png on Alder). (2) Dropbox: after 'Aloita synkronointi' the dialog returned to step 1 with 'Viimeistellään kirjautumista…' spinning (screenshot /var/tmp/oh-shots/dropbox.png). Jari also disliked having to copy a URL during the Dropbox flow. Find the causes from the test server's logs and the native tools' (Softeria/Microsoft, rclone/Dropbox) outcomes, fix them, and verify on the test server after the conductor pushes. For the URL copying: record what the native flow requires and propose (in result.md) a flow without manual URL copying if the native tool allows it; implement it if it is a contained change, otherwise leave it as a recorded proposal.

## Additional observation

Jari reported via the conductor on 2026-10-22 that clicking outside the Dropbox
modal during the spinner closed it and Dropbox disappeared from the list.
Investigation includes accidental dismissal and native cleanup of an unfinished
new grant, not just the spinner.

## Acceptance Criteria

- [x] Distinguish first native sync from sign-in and keep the folder step current.
- [x] Backdrop and Escape cannot accidentally cancel an active OAuth connection.
- [x] Accept Microsoft Graph-qualified permission grants without accepting another resource.
- [x] Record failure phases without provider errors or credentials, with focused regressions and checks.

The conductor authorized landing these improvements with the historical Microsoft
cause explicitly unresolved. Live retry and the one/two-code/account-kind facts
remain the conductor's next step after push; see `result.md`.
