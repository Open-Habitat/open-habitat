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

Find a supported way for Pi sign-in to return the browser directly to this
service without device-code entry, or explain why device-code sign-in remains
the practical choice. The useful result is a recommendation grounded in provider
support and a Pi integration path; a detailed callback protocol can follow once
that path is known to exist.

The [research note](analysis.md) records the Pi 0.85.1 source investigation.
Its built-in browser flow returns to localhost on the browser's computer, not
the remote host. Whether the provider permits an HTTPS callback to this service
is still unknown; an anti-bot 403 did not answer it.

Pi owns credential exchange, storage and refresh under the mapped Unix user.
A gateway code relay is a possibility to assess, not an agreed solution. The
returning browser needs to remain bound to the right browser session and Unix
user. Any proposed change to component authority needs Jari's architecture
decision.

A real provider experiment uses a person's account and may leave credentials or
host configuration behind. Jari has asked to hear beforehand what the experiment
will establish and how its temporary state will be removed. Synthetic tests can
exercise host behavior but cannot establish provider acceptance.

The research note should leave the next implementer with the supported options,
the evidence and its limits, and a recommendation: implementation, a bounded
real experiment to resolve a specific uncertainty, or continued device-code use.
