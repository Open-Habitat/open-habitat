# Result: person removal technical decision (2026-11-21)

ADR 0037 (`docs/decisions/adr-0037-person-removal.md`, status Proposed)
proposes what removing a person does and replaces the deferred ADR 0007.
In short: one administrator action withdraws access and closes the person
out of the host (provider grants revoked by the person's own daemon, account
expired, user manager stopped, processes killed); after a grace period the
broker deletes the home and everything else the person owns on the host from
committed state only, proves zero kernel quota usage before the UID can be
reused, and drops the binding. Nothing is handed to the administrator. The
gateway keeps a small removal record. Re-admitting the same GitHub id later
creates a new account.

Implementation issues (unlaned, `preparation: pending`, waiting for Jari's
acceptance of the ADR's authority changes): `person-removal-broker`,
`person-removal-daemon`, `person-removal-gateway` (blocked by the first two),
`person-removal-browser` (prototype round first, which is also Jari's
21.11. next action).

## Decisions for Jari (ADR 0037, "Open questions")

1. Grace period: recommended fixed 14 days plus an explicit "Poista heti".
2. Data handed to the administrator: recommended none, ever.
3. Revoke provider grants at scheduling (recommended) or only at deletion.
4. Removal record retention: recommended until the administrator clears it.

## Decisions for later review (made by best judgement)

- **Removal is a separate action from withdrawal.** Alternative: make
  "Poista pääsy" itself schedule removal. Withdrawal stays as the reversible
  action because it is the right tool for a temporary break.
- **The broker runs due removals itself (start + hourly).** Alternatives: a
  root systemd timer calling the control socket, or the gateway calling at
  the due time. The due time lives in the broker's ledger and only root can
  act on it; the gateway has no scheduler.
- **UID reuse is allowed after a zero-usage kernel proof** rather than a
  retired-UID ledger, which ADR 0007 had already rejected. Without user
  quotas there is no such proof; the deletion steps are the only guarantee.
- **The `gh` token is not revoked at GitHub**: it would need the OAuth app's
  client secret together with the token, and the gateway must not receive a
  native credential. Its only copy goes with the home.
- **The product sends the person no notice**; that is left to the
  administrator, whom the dialog reminds.

# Lane outcome (2026-11-23)

The reported case is fixed: removing a person (Käyttäjät ja pääsy › Poista
henkilö, or `admin access remove-person`) closes them out at once, and from
that moment Levytila marks their row "Poistetaan pp.kk." and counts their use
instead of their limit, so the sum of limits drops below the disk and the
warning clears without lowering anyone's quota by hand. After the grace
period (or at once) the broker deletes the home and account and the row
goes. The four implementation issues carry their own results and decisions:
`person-removal-broker`, `-daemon`, `-gateway`, `-browser`. ADR 0037 and the
prototype round are removed now that the code carries them; the rules the code
cannot show are in `internal/AGENTS.md`.

An independent review (GPT Astra finder, Claude Fable verifier, critical
rigor) found six defects, all confirmed and fixed with tests: bind mounts
inside a home, an interrupted binding drop, the gateway record race, host
apply re-admitting a person under removal, an interrupted cancel, and root's
control deadlines.

Not run: a privileged lab check of the native steps on a disposable host. The
build host has no KVM, and the pilot installation is not disposable.
