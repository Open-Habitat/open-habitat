# Result: restore daemon sockets after reboot

The broker verifies the committed ledger at startup, then asynchronously starts admissible bindings' inactive sockets via `LinuxHostExecutor.Ready`, which verifies the account and unit, checks the installed JIT gate dependency, starts the socket, and verifies it again. The broker continues to serve while restoration proceeds; it tries later bindings even when one activation fails. Starts are serialized because the installed Fleetrepo gate checks that every sibling listener is fully active. `authorize` remains read-only. Revoked bindings are still verified, but not activated under allowlist admission.

The neutral broker service now has a boot install target. **Deployment prerequisite:** Fleetrepo must prepare and verify `/run/open-habitat` ACLs and quota enforcement before enabling/starting both broker units at boot. Its current JIT policy explicitly keeps sockets disabled at boot. Enabling the broker service before Fleetrepo installs this ordering will cause fail-closed startup, not working restoration. The release worker must update the concrete installation and run a real guest reboot proof; the existing VM reboot diagnostic intentionally checks the unprepared/disabled state and does not prove automatic restoration. Do not enable per-user daemon sockets directly.

## Decisions for review

- Keep socket activation solely in the root broker and retain a read-only gateway authorization path. This avoids granting gateway a new authority to start units on request.
- Serve during restoration, but start user sockets serially: the deployed JIT gate refuses sibling sockets that are still activating. A slow or failed start delays the restoration queue for at most the command's bounded timeout; it does not stop the broker or skip later users.
- Skip activation for a bound ID removed from the allowlist; keep startup verification of its NSS identity and quota, and preserve its binding for administration. Admission `any` activates all committed bindings.
- Leave UI wording to the web worker; until the concrete boot deployment is in place, signing in again may recover an inactive socket through `ensure`.

## Verification

Focused provision tests include a reboot-like inactive socket, a failed Carol gate, continued broker lookup during activation, successful later Dana activation, and verification but non-activation of a revoked binding. The race-enabled focused test passed. The full clean gate passed on the initial implementation commit; rerun on the final reviewed commit is required before closing. No live boot was run in this worktree.
