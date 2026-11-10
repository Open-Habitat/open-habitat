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
- Live check: passed on pilot.695; see the follow-up evidence below.

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

## Live verification — 2026-11-10

Passed on `open-habitat-test-nbg1`, `0.0.0-pilot.695`, commit
`f9ccdd9093df8d15e2c93db01e33965b89eb6d4b`, at 07:45–07:48 UTC.
Access was through Alder's pinned root SSH connection; no keys moved to
Birch. Only synthetic Alice and Bob were restored and withdrawn. No gateway,
broker, real person's daemon or user manager was restarted manually.

[Command outputs and journals](live-check.log) and
[final withdrawal/process readback](live-final.log) contain the evidence.
For each state, `systemctl is-active` was run separately for
`open-habitat-daemon@NAME.service`, `open-habitat-daemon@NAME.socket` and
`open-habitat-agent@NAME.socket`, in that order:

| Step | Service | Daemon socket | Agent socket |
| --- | --- | --- | --- |
| Alice: `admin access add --github-id 9100000001 --json` | inactive | inactive | inactive |
| Alice: broker `ensure` | inactive | active | active |
| Alice: own-UID `agent environment show --json` | active | active | active |
| Alice: `admin access remove --github-id 9100000001 --json` | inactive | inactive | inactive |
| Bob: restore, ensure, own-UID request while Alice withdrawn | active | active | active |
| Alice: restore and ensure again | inactive | active | active |
| Alice: next own-UID request | active | active | active |
| Final withdrawal: Alice, Bob, Carol and Dave | inactive | inactive | inactive |

The commands used `/opt/open-habitat/current/bin/open-habitat`.
Bob's subject is `9100000002`. Broker requests ran as
`open-habitat-gateway`, using the native length-prefixed Unix transport and
`{version:1, operation:"ensure", provider:"github", id:ID, candidate:NAME}`.
Each returned the existing UID/name/socket route, without a failure.
Daemon requests ran through `runuser -u NAME -- ... agent environment show
--json` and reported the same pilot.695 daemon commit.

Alice's passwd row, home inode `6291457`, ownership `21035:21035` and mode
`700` stayed unchanged. Her user manager stayed active with MainPID `1740729`,
InvocationID `008838036a3547acb0b19468abe3151f` and `Linger=yes` before and
after both withdrawals. This verifies account/home identity and user-manager
continuity, not a byte-by-byte home or credential comparison.

Journal evidence:

- 07:47:02 gateway: `access_withdrawal`, `accepted`, `denied`, Alice;
  07:47:03 broker: `broker_withdrawal_stop`, `stopped`, Alice; gateway then
  reports `withdrawn`.
- 07:47:04–05 Bob's Fleetrepo JIT gate: `status: verified`, `fixture: false`,
  `phase: activation`; broker `ensure accepted`; daemon `service_ready`.
  No manual listener stop or gate override was needed.
- 07:47:07 Alice's JIT gate verifies again; at 07:47:08 the broker accepts
  ensure and the next request starts the daemon.
- Final withdrawals report `broker_withdrawal_stop stopped` for both.
  `admin access list --state withdrawn --json` confirms all four synthetic
  subjects withdrawn and denied.

Two initial harness attempts were corrected, not product failures: an agent
request immediately after admission found no socket because broker ensure had
not yet run; the first handwritten ensure omitted required `candidate` and
received no reply. The corrected full sequence exited 0. Restore alone changes
admission; ensure (normally sign-in) restores sockets, then a request starts
the daemon. Bob's final stop logged systemd's ignored `Failed to kill control
group ... Invalid argument`; follow-up showed `Result=success`, `MainPID=0`,
empty ControlGroup and `inactive/dead`, with only his user manager and sd-pam
remaining. No surviving daemon or product failure was observed.

### Scope, review and checks

The chosen live path uses broker ensure and an existing synthetic account's
cold daemon activation rather than real GitHub OAuth or first-account creation.
That is the brief's daemon-restart alternative and exercises the strict JIT
activation gate. Browser sign-in, model turns, existing tmux jobs and failure
injection were not tested. No new product decision or intake issue was needed.

Review: manual evidence-to-claim and diff review. This follow-up changes only
evidence and the completed checklist, not session, daemon or authorization
code; the implementation's independent critical review remains above.
No Go/browser suite or independent LLM review was run for this evidence-only
diff. Validation: `git diff --check`, `python3 scripts/validate-project-view.py`
and the private narrative validator passed. The completed live-check line was
removed from `KOKEILTAVAA.md`.
