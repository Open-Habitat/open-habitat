# Result: daemon disconnect before removal

`POST /internal/v1/account/disconnect-all` (`internal/daemon/disconnect_all_linux.go`)
is the gateway's own request, mounted only on the daemon's main socket, never
the agent listener; the gateway's browser mux has no `/internal/` route, so
it cannot be proxied. As the person, with their own credentials only, it:

- revokes Google grants (refresh token from rclone or gog) and Dropbox grants
  (`token/revoke`), then removes each account as the catalog's own remove
  does, and stops its sync;
- removes Microsoft, Atlassian, Trello, IMAP, CalDAV and CardDAV accounts
  locally (`local_only`);
- revokes each glab token with `DELETE personal_access_tokens/self`, then logs
  it out as `glab auth logout` does; removes tea's Gitea logins (`local_only`)
  and the Git helper registrations;
- logs the person's own Tailscale node out of their tailnet (LocalAPI
  `logout`), then disconnects it as the Omat koneet page does;
- leaves `gh` alone.

The reply is counts per provider and outcome, never an account name. A repeat
finds nothing and answers empty counts.

Checks: `./scripts/test-focused.sh --area go` for `./internal/daemon/integrations`,
`./internal/nativegitlab`, `./internal/nativeforge` green. `./internal/daemon`:
the new handler test passes. One run failed in `TestAgentConversationControls`
(conversation archive `writer_conflict`), which this change does not touch.

## Decisions for later review

- **No `contracts/v1` schema for the request.** The issue says the contract
  change starts in `contracts/v1/`. The gateway↔daemon internal routes (the
  site key give, the speech key) are not in the browser/host contract, and
  this one follows them; the browser-visible counts are in
  `server-access.schema.json` (gateway unit).
- **A failed revocation still removes the local entry and counts `failed`.**
  Alternative: keep the entry for a retry. Nothing would retry it: the
  account is closed out next and the token goes with the home.
- **Atlassian and Trello count `local_only`.** The ADR names neither; neither
  offers revocation with the person's token that the catalog uses today.
- **A stopped Tailscale node counts `failed`.** It cannot be logged out
  without running; its key is deleted with its state, so it can no longer
  connect, but the device stays listed in the tailnet.
- **The forge HTTP client gained one DELETE**, only for GitLab's
  self-revocation, which ADR 0037 decides.
