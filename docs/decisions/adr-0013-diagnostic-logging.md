# ADR 0013: Diagnostics are correlated across services and read along the Unix user boundary

**Status:** Accepted by Jari on 2026-10-05.

An operator who gets a report of a failed login or a stuck agent needs to find
the matching records in the gateway, the broker and the user's daemon. Today
each service writes its own stderr records, the gateway's login attempt ID
stays inside the gateway, and the browser receives the constant
`req_00000000` as a correlation ID. Records from the three services can only be
matched by time, which fails as soon as two people log in at once.

The gateway's random login attempt ID travels with the request over the two
internal channels: the broker's request protocol and the daemon's credential
handoff frame. Both receivers validate it as a short opaque token and copy it
into their own records. Ordinary browser requests get a separate reference that
the gateway generates for each failure, returns in the error response and
writes into its record. The two references are joined only inside gateway
records. A reference is diagnostic data and nothing else: peer credentials, the
allowlist, the mapped socket and the verified session keep deciding who is
allowed to do what. A correlation value the browser sends is ignored, because a
browser-chosen value could be made to collide with another user's trace.

Records stay in the systemd journal of each service. Root reads broker
records. The restricted operator login reads gateway records and every user's
daemon records. A user may read their own daemon records. No other user reads
them, which keeps the Unix user boundary for diagnostics too. If journald
cannot express this separation on a deployment, the limitation comes back as a
new decision rather than a copy of the logs in a store of our own.

A privileged action is attributed to the identity the authorizing component
verified. For a browser-managed change that is the session actor, recorded
apart from the target user and the changed setting. For a root-only control
action, such as revocation, the verified identity is a root peer, and the
record says so. Naming a person there would be a guess, since nothing
authenticates which human ran the command. If operator-level attribution is
wanted later, it needs its own identity mechanism and its own decision.

Ordinary diagnostics are kept for seven days, broker and privileged-change
records for thirty. Fleetrepo sets these on the test server, measures the real
volume and adjusts; if the journal cannot keep the two classes apart, the
longer figure applies to all records and the documentation says so.

[The logging issue](../../issues/decide-logging-policy/item.md) holds the
inventory, the proposal and the implementation plan.
