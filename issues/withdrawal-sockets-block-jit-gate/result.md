# Result

Withdrawal now stops the person's Open Habitat daemon and both sockets
through the broker. This implements Jari's decision of 10.11.2026.

- Broker (`internal/provision/withdrawal_linux.go`, `Writer.Handle`). A
  `withdraw` that commits, or repeats, a bound person's withdrawal then stops
  `open-habitat-daemon@<user>.service`, `open-habitat-daemon@<user>.socket`
  and `open-habitat-agent@<user>.socket`. It runs one `systemctl stop`,
  then `reset-failed`, and counts the person as stopped only when all three
  units are `inactive`.
  - The broker rereads which bindings qualify from committed state under the
    ledger lock: the runtime entry must be `withdrawn`, no source may admit
    the person, the head must match and admission must not be `any`. A name
    from the request is never used.
  - The stop runs after the ledger lock is released, while holding the
    activation slot. A socket start the broker asks for therefore waits for
    the stop rather than being undone by it.
  - The new `HostExecutor.StopListeners` starts nothing and offers no
    general unit operation.
- Failure. A failed stop answers `state_unavailable`. The gateway already
  maps that to `ErrAccessUncertain`, which keeps the durable deny; the deny
  and session removal still come first. A failed stop is retried by
  repeating the withdrawal (`admin access remove`) and by every broker
  start. The broker runs that retry before startup verification, so a
  daemon still deactivating cannot stop the broker from starting.
- Restore after a stop, and after a failed stop, works. `unit()` now accepts
  a `failed` daemon service on retry: one a timed-out stop killed is not
  running.
- Budgets. `withdraw` gets ensure's exchange budget (90 s) and its slots.
  Root's `access_remove` control deadline is 100 s. The `systemctl stop`
  command budget is 60 s.
- Documentation: `internal/AGENTS.md` (the withdrawal rule replaced, with its
  reason), `docs/operations.md`, the `server-access` contract description,
  `TESTING.md` and the access confirmation dialog ("Avoimet istunnot ja
  selaimesta käynnistetyt keskustelut päättyvät.").
- Tests:
  - broker: stop on withdraw, repeat stops again, nothing stopped for
    operator, never-bound, admitted or unknown subjects or under `any`,
    rolled-back state refused, failed stop keeps the withdrawal committed and
    is retried, restore after a stop and after a failed stop, activation-slot
    exclusion, budgets, `unitShown`;
  - gateway: a failed stop keeps the deny, a repeat finishes it, restore
    lifts the deny, control deadline;
  - root container (`scripts/test-broker-boot-uids.sh`):
    `TestWithdrawalStopListenersAsRoot` runs the native stop as root with
    systemctl recorded.
- No systemd unit or socket template changed, so no Fleetrepo change is
  needed. Fleetrepo's JIT gate stays strict as decided.
- Live check: not run by this worker. The conductor deploys after the
  merge. The check is in `KOKEILTAVAA.md`.

## Review

The level was critical, because this changes the root broker's authority.
`/llm-review` used GPT-6 Astra as finder and Claude Fable 5.1 as verifier,
two calls in all, and `/assess-findings` triaged the result.

| Finding | Assessment | Outcome |
|---|---|---|
| F1 (Astra): startup verification ran before the startup retry, so a daemon still deactivating from a timed-out stop made the broker exit, with `Restart=no`, before it could retry | CONFIRMED, OCCASIONAL | FIX, applied: the retry now runs before startup verification |
| F2 (Fable): a `site.json` admission landing between the locked read and `systemctl stop` would stop an operator's daemon once | COSMIC_RAY, heals at the next sign-in | DROP (rule 1b) |
| F3 (Fable): a daemon that ignores SIGTERM for more than 60 s at startup keeps the broker down until systemd's 90 s kill | RARE, bounded | DROP (rule 1b) |

Fable found no defect at the authorization boundary: the stop set comes only
from committed state, as a withdrawn entry with a binding that no source
admits. It found no liveness defect either. After the review, `Handle` also
requires a non-empty ID before it stops anything. No intake issues were
filed, because nothing passed the filing bar.

## Decisions for later review

1. **How a failed stop is reported: `outcome_uncertain`, no new code.**
   - Alternatives: a new code such as `listeners_running` in the contract,
     CLI and browser; or a 200 reply carrying a flag.
   - Why: the existing uncertain path already keeps the deny and tells the
     administrator to look and repeat, and it needed no new vocabulary. One
     limit: the browser's withdrawn row offers only restore, so a repeat runs
     from root's CLI. The broker's next start also retries automatically.
2. **The stop does not verify the account first.** Ending a withdrawn
   person's daemon should not depend on their home or NSS entry being
   intact. The unit names come only from the committed binding, and the
   username grammar is still checked.
3. **`unit()` accepts a `failed` daemon service on retry.**
   - Alternative: reset failed state only inside the stop.
   - Why: a stop that times out finishes later in systemd and leaves the
     service failed, and nothing would reset it. Without this, restore and
     broker startup would refuse. This also removes the older fragility where
     a daemon crashed past its restart limit blocked broker startup.
4. **The startup retry covers only bindings whose runtime entry is
   `withdrawn`.** People removed from root's `site.json` are not included:
   Jari's decision covers withdrawal only. If root revocation should also
   stop listeners, that is a separate decision.
5. **Withdraw shares ensure's two mutation slots.** When two sign-ins are
   mid-ensure, a withdrawal is refused at the transport and comes back
   uncertain. The deny holds and the administrator repeats it.
6. **A stop that times out does not latch the activation fence.** Starting
   that person's socket again requires admission, which the binding gate
   checks anyway.
