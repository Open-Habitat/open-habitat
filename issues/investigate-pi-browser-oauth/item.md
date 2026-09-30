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

## Starting point

The [source investigation](analysis.md) found that Pi 0.85.1 fixes its browser
callback to localhost on the user's computer. It did not establish whether
OpenAI permits an HTTPS callback to this host. An earlier anti-bot 403 does
not settle that question.

Establish provider support and an available Pi integration path before investing
in a detailed protocol. Pi owns credentials under the mapped Unix user. A code
relay through the gateway is one possible design; assess it by whether it keeps
the returning browser bound to the right session and Unix user without moving
credential ownership into the gateway.

A real provider experiment involves a person's account and may leave credentials
or temporary host configuration behind. Jari wants to hear about that experiment
before it happens; describe what it will establish and how its temporary state
will be removed. Disposable synthetic tests are useful for host behavior, but
cannot establish which callbacks the provider accepts.

## Result

Record the supported options, evidence and remaining uncertainty in the research
note. Recommend implementation, a bounded real experiment, or continued
device-code sign-in. Explain any proposed change in component authority so Jari
can decide the architecture. A full protocol design is useful once a feasible
path has been found.
