---
created: 2026-10-28
updated: 2026-10-28
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-10-28/admin-add-before-first-sign-in
lane: admission-ui
preparation: pending
---

# Cannot make someone an administrator before they have signed in

## Description

Jari 2026-10-28 (Birch ja Contoso, pilot.13): Ylläpitäjiä ei saa lisättyä, ellei käyttäjä ole jo kirjautunut. Ylläpitäjän pitäisi voida nimetä etukäteen (GitHub-nimellä tai ID:llä), ja rooli sitoutuu ensimmäisellä kirjautumisella samaan tapaan kuin site.jsonin julistetut ylläpitäjät (declared-admin-binds-at-sign-in: deferred_until_bound).

## Acceptance Criteria

- [ ] Selaimen ylläpitäjä voi nimetä vielä kirjautumattoman ylläpitäjäksi; rooli sitoutuu ensimmäisellä kirjautumisella; testi

## Comments

### 2026-10-28T05:17:50Z · @claude

Stopped before implementing (run 01m608p020rvwzkxxkndbb05hf): the browser
currently has no role write at all. `internal/AGENTS.md` and
`internal/gateway/administration.go` (`adminHTTP`, `changeRole`,
`declareRole`) carry the ADR 0030 rule that administrators come only from
root's site.json, converged by host apply over the control socket. The
deferred `pending_administrators` path exists, but only root's
`role_declared` control operation can add to it. Letting a browser
administrator name an administrator, before or after sign-in, moves
role-granting authority from root to a browser session. That is Jari's
decision.

What works today without a change: add the GitHub numeric id to site.json
`administrators` and run `host apply`. The receipt says
`deferred_until_bound`, and the role binds at first sign-in.

Recommended if browser grants are wanted: the browser records only a pending
declaration by numeric id, resolved at entry from the login with the
existing lookup, and organisations and bots refused. It reuses
`PendingAdministrators` and `grantPendingLocked` at the sign-in broker
recheck, and revoking before sign-in removes the pending entry.
Open questions:
(a) how a browser-named administrator survives host apply: `convergeRoles` makes the gateway's administrators exactly site.json's, so today the next apply would remove it;
(b) whether a browser administrator may also revoke another administrator.
