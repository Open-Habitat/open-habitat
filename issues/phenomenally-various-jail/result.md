# Browser race fixes implemented; required whole-suite blocker remains elsewhere

Run `01m5ek6zt9jh7v54nffsxk3ccv`; final runnable source `f8f07efc`, integrated on main `6da753c8`.

- Release test waits for the remounted version row and current-document finite release/settings reads before replacing the gateway. It polls the actual replacement gateway version before dispatching visibilitychange. Tracking begins after document navigation so canceled old-document reads cannot remain as phantom pending work.
- Lost archive reply waits for the real upstream write and route abort to finish before navigation/unroute. Optimistic visibility alone was not completion evidence. Upstream success is asserted; no error is silently swallowed.
- Explicit reconnect keeps the simulated outage until the real retry click, rather than allowing epoch recovery to detach the button before Playwright can click it.
- Uncertain creation keeps list reads offline through reload and the failed recheck; only the distinct successful recheck click restores reads. An old read whose execution context reload destroyed remains offline; other evaluation errors propagate.
- Home skip-link test waits for home's entry focus instead of treating a create button shared with the previous workspace as navigation completion.

No product behavior, original behavioral assertion or timeout was weakened; no test case removed. Self-review checked request lifetimes, current-document scope, native version/content contracts, and preservation of main's newer changes.

## Evidence

Configured Cedar route, synthetic per-case hosts, `umask 077`, disk-backed TMPDIR:

- Final fast: 471 passed, 22 s, `/var/tmp/wording-land-final-fast.log`.
- Requested release/mutation specs ×10: 70 passed, 58 s, `/var/tmp/wording-land-final-repeat.log`.
- Reconnect spec ×10 after the navigation correction: 100 passed, 156 s routed / 1.2m Playwright, `/var/tmp/wording-land-recovery-final-repeat.log`.
- Final lab: 62 passed, 34 s, `/var/tmp/wording-land-final-lab.log`.
- Final whole ordinary: **301 passed, 1 failed, 3 capture-only skips**, 151 s, `/var/tmp/wording-land-final-ordinary.log`. All cases in the changed specs passed. The remaining failure is main's second-identical-command duplicate card, recorded separately as unlaned @exorbitantly-ragged-town. The prior integrated whole suite reproduced it too.

The issue stays open because its required whole-suite acceptance is not met; branch/worktree are preserved, not merged. No full gate, live-system or distinct-UID evidence. Read @tests-without-wording's result for the harvested wording work and separate lab residual @deeply-pricey-fuel. Full command/failure inventory: `/var/tmp/wording-land-inventory.md`.
