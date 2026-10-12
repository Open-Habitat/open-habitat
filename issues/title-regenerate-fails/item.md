---
created: 2026-10-12
updated: 2026-10-12
type: bug
status: fixed
priority: normal
related: ['@generate-conversation-titles']
lane: daemon
lane_seq: 1
collision: [internal/daemon/]
preparation: ready
closed: 2026-10-12
closed_by: claude
---

# Manual title regeneration fails

Jari reported on 2026-10-12, on pilot.22, that “Luo uusi otsikko” in the
“Checking the Connection” conversation in the `issuectl` repository showed
only “Otsikkoa ei voida luoda”. The conversation already had an automatically generated title.
That earlier success shows generation had worked for this conversation; it
does not establish why the manual request failed.

At 11:39:40 UTC the gateway logged `daemon_route failed
operation=daemon_request reason=daemon_exchange_failed user=maintainer`.
In `internal/gateway/proxy_linux.go`, this means the transport round trip to
the user's daemon failed while the browser request had not been cancelled.
No corresponding request entry was found in the daemon journal. These
observations do not yet identify the cause. The generation and naming timeouts
are in `internal/daemon/title_linux.go`; the gateway's request ceiling is in
`internal/gateway/proxy_linux.go`.

Restore manual regeneration according to @generate-conversation-titles:
requesting a title can replace an existing automatic title, persists the name
in Pi history and updates the browser. Failure preserves the previous title
and leaves the conversation usable. Make failures diagnosable with fixed
reason codes; raw provider diagnostics can expose credentials or conversation
content. The existing automatically named conversation is the important
regression case. The synthetic lab's real controller and fake Pi can exercise
that lifecycle; distinguish this evidence from real provider behavior as
described in [TESTING.md](../../TESTING.md).
