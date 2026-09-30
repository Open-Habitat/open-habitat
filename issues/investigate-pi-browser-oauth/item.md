---
created: 2026-09-29
updated: 2026-09-30
type: task
reporter: jari
status: open
priority: normal
lane: oauth-design
collision: [docs/, internal/gateway/, internal/daemon/]
---

# Investigate Pi browser OAuth callback

## Goal

Find out whether Pi sign-in can return the browser directly to this service,
without asking the user to enter a device code. Recommend a supported approach
or explain why the existing device-code flow should remain.

## What is known

The [source investigation](analysis.md) found that Pi 0.85.1 fixes its browser
callback to localhost on the user's computer. It did not establish whether
OpenAI permits an HTTPS callback to this host. An earlier anti-bot 403 does
not settle that question.

## Scope

First establish provider support and an available Pi integration path. A full
new login protocol is not a prerequisite for this investigation. Pi remains
the credential owner under the mapped Unix user; gateway code relay is only a
possible design, not an approved requirement. Bring any proposed change in
component authority to Jari before implementation.

If a real provider experiment is needed, inform Jari beforehand and describe
its scope, participant consent, return route and cleanup. Synthetic work uses
disposable state without real identities or credentials. Do not bypass anti-bot
protections. This issue does not authorize a real login or callback implementation.

## Acceptance Criteria

- [ ] Record what supported callback/client configuration and Pi integration are available, distinguishing source findings, synthetic tests and provider evidence.
- [ ] Recommend implementation, a bounded real experiment, or continued device-code sign-in. State any unresolved compatibility question plainly.
- [ ] If recommending implementation, describe the effect on gateway/daemon responsibilities and how the login stays bound to the correct browser session and Unix user. Detailed protocol design belongs to the subsequent implementation work after the architectural choice.
