# Bounded first-ensure deadline — intermediate slice

This changes only broker transport timing and a narrowly scoped gateway failure distinction. Parent @prove-jit-guest-isolation remains open. First ensure receives a 90s server mutation budget after the permitted gateway UID has sent a fully framed, parsed request; peer admission, framing and authorize remain 2s. The client allows 95s total (2s admission + 90s execution + 3s scheduling margin), clipped by caller cancellation. Each Linux command remains separately bounded to 3s plus a 500ms wait delay. At most eight admitted sockets/workers and two valid ensures (one may wait on the serialized writer); excess are closed. Before journaling, a new ensure needs at least 60s remaining or fails without mutation. No automatic journal recovery, account adoption, retry or deletion. Callback token remains outside the broker. A transient broker failure denies a request but no longer deletes a previously valid session; explicit denial still invalidates it. A client that abandons the callback cannot force rollback or gain a reply: an already admitted broker operation continues within its own finite server budget, with pending state preserved if interrupted.

The 90s ceiling is deliberately not the sum of worst-case command bounds: repeated slow NSS/systemd calls exhaust the shared operation budget and require operator reconciliation if mutation started. This is a fail-closed bound, not a guarantee of successful provisioning on a degraded host. Historical guest first ensure timed out without reply after 2.932–4.429s with pending phases account/home/null. New guest measurements below determine whether this bound suffices in the disposable private guest. The global writer lock also means an unrelated authorize can time out during a long first ensure; it fails closed and the web request may receive 401, but the session is retained for a later recheck. No auth redesign is claimed.

## Verification

- `PATH="$PWD/.tools/go/bin:$PATH" go test -race ./internal/provision ./internal/gateway ./internal/daemon ./internal/cli`: exit 0 (precommit).
- `bash test/vm/test-vm-test.sh`: exit 0 (offline; no guest boot).
- `issuectl doctor --json`: exit 0; `git diff --check`: exit 0.
- Focused independent security review: `claude-fable-5-1` finder and `gpt-6-astra` verifier, persisted under ignored `history/review-ensure-deadline.md` and `history/assessment-ensure-deadline.md`. Confirmed findings corrected; remaining availability limits documented above.

Historical static two-user run, clean CI and opt-in JIT guest on committed revision: pending evidence below. Full two-UID first-login isolation, actual credentials, ingress and deployment are **unproven**. No Fleetrepo or host state changed.
