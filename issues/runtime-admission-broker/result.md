# Result: runtime admission

Implemented ADR 0030's two admission sources and the gateway's withdrawal order.

- Broker: the admission file holds root's operator ids, root's
  `runtime_admission` switch and the `site_admin` runtime entries under one
  epoch and lock. New gateway-socket operations `admit`, `withdraw`,
  `access_list`, `access_read`. Effective admission is the union in
  `authorize`/`ensure`, startup restoration and the binding gate. Cap 256.
  Restore verifies the persistent account and rebuilds an absent runtime
  directory (lost at boot) after the commit, with ensure's mutation budget.
- Host: `identities.runtime_admission` in site.json; host apply publishes only
  the operator ids and the switch, keeps runtime entries, skips revocation for
  ids still runtime-admitted, lifts gateway denies for site.json ids; host plan
  reports the runtime entries under `runtime_admission`.
- Gateway: durable deny in administration state, honoured by the login
  callback, session lookup, link redeem, editor sessions and live relays.
  Withdrawal: deny → remove sessions → broker withdraw; restore: remove
  leftover sessions → admit → lift the deny on a confirmed reply. Uncertain
  replies are `outcome_uncertain`. GitHub login/id lookup via the public users
  API as the OAuth app. Browser endpoints `/api/v1/server/access{,/lookup,/add,/remove}`
  (contract `server-access.schema.json`). Browser role write removed (API and
  the toggle in Asetukset › Käyttäjät).
- CLI: `admin access list|lookup|add|remove` with dry runs and typed codes;
  CONFORMANCE rows; operator skill text; internal/AGENTS.md rules.

## Evidence

- Go: `go test ./internal/provision ./internal/gateway ./internal/host ./internal/cli` green
  (umask 077). New: `TestRuntimeAdmission*`, `TestHostPublicationKeepsRuntimeEntries`,
  `TestAccessProtocolRejectsUntrustedInput`, `TestWithdrawal*`,
  `TestUncertainWithdrawalStaysClosedAcrossRestart`, `TestAccessBrowserAPI`,
  `TestAdminAccessCommands`, `TestAccessWriteClassification`,
  `TestApplyLiftsGatewayDenyOnlyForOperatorIDs`, plan admission test extended.
- VM, two real UIDs: `./scripts/vm-test.sh host-runtime-admission --json` passed
  (production prepare, broker and binding gate; every request from the real
  gateway kernel UID): operator id protected, mapped UID cannot reach admit,
  withdrawal keeps account/home/binding, broker restart keeps the withdrawn
  binding's listeners refused, restore after the runtime directory is gone
  returns UID 21033, never-bound withdrawal leaves nothing, switch-off refuses
  admit and still withdraws. Limits: no browser/OAuth in the guest (the gateway
  ordering is proven in Go tests), broker restart rather than cold reboot.
- Review: `/llm-review` critical rigor (finder gpt-6-astra, verifier
  claude-fable-5-1); 4 confirmed findings, all fixed (restore after boot,
  deny cleanup error, switch order, deny outliving a site.json admission).

## Decisions for later review

- Runtime entries live in the broker's allowlist.json (raised to 64 KiB)
  rather than a separate file, so one epoch covers every admission change and
  host apply's compare-and-publish token sees them. Consequence: a browser
  admission between `host plan` and `host apply` makes the plan stale.
- Withdrawal removes sessions without requiring broker `authorize` first
  (RevokeSubject's check), because the durable deny already refuses and a
  repeated withdrawal must work after the broker has withdrawn.
- A definite broker refusal of a withdrawal (operator_owned raced in) lifts the
  deny again; the removed sessions stay removed.
- A never-bound withdrawal also lifts the deny, so a later site.json admission
  is not silently refused. A bound withdrawal keeps it until restore or host
  apply (for site.json ids).
- `admit` for an already-admitted entry succeeds while the switch is off; the
  switch bounds additions only.
- The access list joins administrators and denies but not last-seen (left to
  `site-access-tab`). `actor` is the administrator's GitHub id or `root`.
- Browser lookup and add use the OAuth app's credentials for the users API; a
  bot account is refused like an organisation.
