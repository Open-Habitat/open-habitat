# Result

Root revocation now stops the person's Open Habitat daemon and both sockets
through the broker, the same way a browser withdrawal does (Jari,
10.11.2026). A person is revoked when `site.json` no longer admits them and
`host apply` converges that.

- Host apply (`internal/host/apply_control_linux.go`, `converge`). The
  order is: session revocation, publication, the broker observing the new
  epoch, then the stop. Apply sends `access_stop_revoked` to the gateway's
  root control socket on every run. A failed stop returns
  `ErrRevokedListeners`, which the CLI reports as `revoked_listeners_running`
  (exit 2). By then the revocation is already in force and the sessions are
  gone. Entries stay closed, as with every converge failure. Continuing the
  same approved input resumes converge and repeats only the stop.
- Gateway (`accessControl`). The gateway relays the request to the broker
  as `stop_revoked` with id `"0"`. The request names nobody, and no field is
  accepted. The deadline is 100 s, the same as `access_remove`.
- Broker (`internal/provision/withdrawal_linux.go`). Withdrawal and
  revocation now share one stop path, `stopRevoked`. It holds the activation
  slot and rereads committed state under the ledger lock. A binding counts as
  `revoked` only when no source admits the person and they either have a
  withdrawn runtime entry or are on the admission file's new `revoked` list.
  Each broker start retries the stop for all such bindings.
- Recording revocation (`revoked` in `allowlist.json`). `operatorPublication`
  adds a bound id when it drops the id from the operator source and no other
  source admits it. Any broker admission write, or a later publication, then
  removes every id that some source admits. A person who loses team
  admission is never stopped: they left the team, the team was removed, or
  their record was forgotten. Team changes leave open sessions as they are.
- Restoring a person works the usual way. Add them back to `site.json`, run
  apply, and the record goes. Their next sign-in's ensure brings the sockets
  back to the same account.
- Docs updated: `internal/AGENTS.md` (broker rule), `docs/operations.md`,
  `TESTING.md`, `KOKEILTAVAA.md` (pending live check).

## Checks

- `./scripts/test-focused.sh --area go` for `internal/provision`,
  `internal/gateway`, `internal/host` and `internal/cli`: green.
- `scripts/test-broker-boot-uids.sh` (the root container): green.
  `TestRevocationStopAsRoot` runs the writer with the native executor as
  root, with systemctl recorded. It confirms that only the revoked person's
  three units are stopped.
- New unit tests:
  - revocation through real operations (runtime- and team-admitted people
    are left running, a failed stop keeps the revocation in force, a repeat
    stops again, restore works);
  - team removal and forget stop nothing;
  - the `revoked` record is parsed strictly;
  - `stop_revoked` names nobody;
  - the gateway control relay, and its deadline;
  - apply's stop request and its error.
- Not run: the live check on the test server. It is in `KOKEILTAVAA.md`
  because the conductor pushes after merge.

## Review

The level was critical, because this changes the root broker's authority.
`/llm-review` ran GPT-6 Astra as finder and Claude Fable 5.1 as verifier,
two calls in all, and `/assess-findings` triaged the result. A caller error
sent the finder's call without its prompt text; it still reviewed the
attached diff.

| Finding | Assessment | Outcome |
|---|---|---|
| F1 (Astra): the first predicate ("no source admits and no team record") also matched people whose team was removed or whose record was forgotten, so their daemons would have been stopped | CONFIRMED, OCCASIONAL | FIX_WITH_CARE, applied (`revoked` record) |

Fable checked the fixed diff and refuted four claims: that someone still
admitted could be stopped, or a name taken from a request; that team losses
or a stale record could cause a stop; that apply's retry is fake; and that
the budgets are defective. No intake issues were filed.

## Decisions for later review

1. **A failed stop fails host apply and keeps entries closed.**
   - Alternative: let apply finish and report a warning.
   - Why: a re-run of an apply that already completed short-circuits as
     `no_change`, so nothing would retry the stop. The existing
     revocation-failure path in converge also stays closed. Cost: the whole
     site stays closed until the stop succeeds, normally on the next
     continuation.
2. **Revocation provenance is a new `revoked` field in the admission file.**
   - Alternatives: infer it from state, which the review showed to be wrong;
     or have apply pass ids, which cannot be retried after publication.
   - The field is broker-owned, bounded and strictly parsed.
3. **People revoked from `site.json` before this release have no record**,
   so they are not stopped retroactively. The test server is disposable,
   and a person can be restored and removed again.
4. **Losing team admission never stops listeners.** Jari's decision covered
   root revocation and withdrawal. Team changes already leave sessions open
   by design.
5. **Stops run one after another inside the 90 s exchange.** Several daemons
   that each ignore SIGTERM can exceed it. Apply then fails, and each
   continuation still finishes at least one more stop.
