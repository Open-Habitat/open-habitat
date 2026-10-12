---
created: 2026-10-12
updated: 2026-10-12
type: bug
status: open
priority: normal
related: ['@generate-conversation-titles']
lane: signin-fix
lane_seq: 10
collision: [internal/daemon/]
---

# Manual title regeneration always fails

_Source: chat_

Jari, 2026-10-12, pilot.22, conversation "Checking the Connection" in `issuectl`: "Luo uusi otsikko" only shows the error "Otsikkoa ei voida luoda". The automatic title had been generated earlier (in English, see `new-conversation-view` item 8), so title generation works in principle.

Evidence: at 11:39:40 UTC the gateway logged `daemon_route failed operation=daemon_request reason=daemon_exchange_failed user=maintainer` (`internal/gateway/proxy_linux.go`: the transport round trip to the user's daemon failed while the browser was still connected). The daemon journal has no entry for the request. `internal/daemon/title_linux.go` bounds generation at 15 s and `set_session_name` at 4 s; the gateway's finite ceiling is 60 s.

Find why the daemon drops or fails the exchange for a manual title request (crash/panic in the handler, closed connection, RPC child state after the automatic title), make the daemon log a fixed-reason diagnostic when title generation fails, and make the regeneration work. Reproduce in the lab with the real controller and fake Pi, and with a conversation that already has an automatic title.
