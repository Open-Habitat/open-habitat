---
created: 2026-09-28
updated: 2026-09-30
type: task
status: open
priority: normal
related: ['@design-first-use-onboarding', '@add-pi-device-adapter']
lane: gateway-pi-gate
collision: [internal/gateway/, internal/daemon/, contracts/v1/, docs/]
blocked_by: ['@add-pi-device-adapter']
---

# Show OpenAI onboarding when Pi sign-in is missing or uncertain

After browser login, first-use onboarding is required before normal workspaces,
native history or agent controls open. The user goes through GitHub repository
selection and checkout, then OpenAI sign-in through Pi. Selecting repositories
is optional: continuing with none selected advances to the OpenAI step.

When Pi is not signed in, show the OpenAI step of onboarding, including when the
user arrives through a direct URL or a stale tab. If Pi's sign-in state cannot
be determined, show the check failure and a retry option in that same step;
unknown state does not establish that credentials are missing.

The first-use repository chooser and checkout are the narrow exception agreed
in @github-repos-first-onboarding. They do not open the normal workspace,
history or control routes before Pi sign-in.

Pi handles credential exchange and refresh and stores credentials in its own
format in the mapped Linux user's home directory. The host has no separate
Pi credential store.
The daemon starts Pi's native device-code operation and relays its instructions
and progress; the gateway authenticates the browser and routes to that user's
daemon. This keeps Pi credentials out of the gateway and preserves ordinary
SSH/tmux use. A pending attempt belongs to both its Unix user and its browser
session: neither another user nor another login session can take it over.

An interrupted attempt or lost daemon state leaves sign-in uncertain. Recovery
comes from checking Pi's native state, so an old browser view cannot turn missing
state into a successful login. The approved device-code interaction is recorded
in @design-first-use-onboarding, with the repository-first ordering above.

The code already checks Pi sign-in before allowing workspace and history reads.
It also provides browser requests to start, check and cancel sign-in, limited
to the browser session that started the attempt, with a defined message format
between browser and host. These pieces do not establish that the whole onboarding
journey is complete. [result.md](result.md) holds their browser and distinct-UID
test evidence; [repository-first evidence](../github-repos-first-onboarding/result.md)
covers the exception. Finish the remaining integration from the current code and
record what now demonstrates the access boundaries and recovery behavior.
[TESTING.md](../../TESTING.md) explains what each test layer establishes.
The onboarding work owns the wizard; @build-agent-control owns conversation
control and terminal-history behavior.
