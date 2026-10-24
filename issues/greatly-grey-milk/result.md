# Result

Both two-UID VM scenarios pass again. Neither failure was a product
regression: the restore path and the runtime admission behave as designed,
and the fixtures and proof had fallen behind the product.

## Verdict: "admitted sibling not restored"

Not a product regression. A diagnostic run on unchanged main (`ef687d84`), with
temporary uncommitted timing prints in the broker executor, showed the stage-2
cold boot (guestone revoked, guesttwo admitted):

```
[ 91.69] OHDIAG cmd /usr/bin/getent [initgroups guestone] took=1.59s err=<nil>
[ 94.89] OHDIAG cmd /usr/bin/systemctl [show open-habitat-agent@guestone.socket ...] took=3.04s err=signal: killed
[ 94.89] OHDIAG unit open-habitat-agent@guestone.socket err=context deadline exceeded
[ 95.02] broker service_failed reason=broker_unavailable
```

Broker startup verifies every committed binding, including the revoked one
(whose units must still be installed and inactive). Under QEMU TCG, cloud-init
and snapd boot work kept systemd so busy that one `systemctl show` outlived the
executor's fixed 3 s command budget. The probe failed, startup refused (fail
closed, `Restart=no`), and so no listener was restored for the admitted
sibling. Runtime admission (`allowlist.json` runtime entries and switch) is not
involved: the stage edits only `ids`, and startup merges `ids` and admitted
runtime entries before the gate.

This confirms what the issue suspected: executor command timeouts under
emulated-guest load. The product budget is unchanged. The boot-binding fixture
now disables cloud-init and masks snapd for its proof boots, which the proof
does not need. Since this is a fixture-only change to a security-relevant boot
path, no independent product review was needed.

## Fixture and proof changes

- `product-fixture.py` / `product-proof.py`: the routing guest runs production
  `host prepare` (dry-run plan, approved apply) after its quota home exists,
  with a site file derived from `site/example.json`. Storage, proc, broker,
  binding-gate and listener units, the proc group and the storage policy now
  come from prepare. Only `open-habitat-daemon@.service` (which `apply`
  installs) is copied in. The broker and binding gate build `/run/open-habitat`
  and its named ACLs instead of the proof. Trusted config ownership is set
  before the broker starts, because the gate verifies it. `test-vm-test.sh`
  asserts that no boot-guarded unit is hand-installed.
- `fake-gh.py`: the native adapter (since `2294a298`/`c2826358`) infers absence
  only from gh's exact no-hosts diagnostic and calls
  `gh api --hostname github.com user`. The stand-in exited 1 silently and knew
  only the older argv, so the first handoff failed with `native_adapter_error`.
  This also affects the JIT guests that share the stand-in.
- Root-peer probe: the daemon's peer gate can close before the probe writes, so
  EPIPE on the write now counts as rejection too (a run failed with
  `BrokenPipeError`). An unexpected exception now names its proof line.
- `host-boot-binding-proof.py` dumps the journal with monotonic timestamps.

## Evidence

All runs were on Alder, one VM at a time, with nothing else heavy running.

| Run | Tree | Outcome |
| --- | --- | --- |
| `host-boot-binding` | main `ef687d84` | failed, `admitted sibling not restored` (reproduced) |
| `host-boot-binding` + timing prints | main + uncommitted diagnostics | failed; timeout shown above |
| `two-user-routing` | after prepare change | failed at OAuth callback, `native_adapter_error` (stale fake gh) |
| `two-user-routing` | + fake gh | failed, `BrokenPipeError` (root-peer probe) |
| `two-user-routing` | `43ffc6be` | **passed**, 239 s of 600 s |
| `host-boot-binding` | `43ffc6be` | **passed**, 5 cold boots, 808 s of 1200 s |
| `vm-test.sh self-test` | branch | fixture-valid |

The previous worker's preserved commit `681045eb` (branch
`wt/aeqymrarjr-vm-two-uid-harvest`) supplied the prepare and quieting changes
adopted here. Its run of `host-boot-binding` passed with them (892 s). The
`OHDIAG` prints in `77d4028e` were diagnostics only and were not adopted.

## Decisions for later review

- Broker startup is all-or-nothing, with a fixed 3 s budget per probe command
  and `Restart=no`. A boot slow enough to stretch one `systemctl show` past 3 s
  leaves every person's listener unrestored until an operator restarts the
  broker. This fails closed and was observed only under TCG, so it was left
  as it is. Whether a bounded broker retry on boot is wanted is a product
  choice.
- The routing guest's site file is `site/example.json` with the guest's home
  UUID and placeholder secret paths. Its gateway UID and identity range differ
  from the guest's precreated accounts (21001–21003). Prepare accepted it and
  the scenario passes, because the broker state the fixture seeds governs
  those accounts. Aligning the two would tie the fixture to more of prepare's
  inputs than this proof needs.
- Per TESTING.md, a worker lands with the checks that match its change (VM
  self-test and the two scenarios) rather than the full clean gate. Only
  `test/vm` changed.
