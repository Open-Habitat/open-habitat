# Packaged-release concurrent gateway callback guest — bounded acceptance

The parent remains **OPEN**. This is a synthetic, disposable PID1 guest, not a live-host installation, real GitHub authentication, reboot smoke, or proof of crash/reconciliation. No host activation, reboot automation, real credentials, ingress or deployment was performed. The historical `two-user-routing` guest is a separate precreated-account baseline.

## Green guest on clean committed source

`./scripts/vm-test.sh jit-concurrent --json` exited 0 after 220 guest seconds on clean committed `3cf4c1fe8c5dcbacb3ae7fd4af5d8ced1b21684c`. The host built production web assets, ran `package-release.sh` and `verify-release.sh`, extracted the verified archive into the private invocation directory, and seeded the guest with its binary and five systemd templates (no locally compiled guest binary). It checked the binary's embedded commit against HEAD before boot and checked the installed guest binary SHA against the staged archive binary. The web assets were packaged and verified, **not served or tested in this guest**.

| Artifact | Receipt |
| --- | --- |
| Archive SHA-256 | `7bb806e35604b6eed66f4774a33418e6159fb6b60667d67423e0efac04f5567f` |
| Embedded/product commit | `3cf4c1fe8c5dcbacb3ae7fd4af5d8ced1b21684c` |
| Extracted/guest binary SHA-256 | `4c42086966d5a2e5e880059a2ceed55406423aaabf3fc4620f3c94665c2fecc6` |
| Immutable Fleetrepo gate input | `85ac4588c9de4c1ceb1fccf58d57753ca58a7688` (nine blobs checked against fixture SHA-256 pins) |
| Image SHA-256 | `612b2c0cc1bc413a6cb8c38fd611794caf0f2b436c50013d8b3794db12ad7354` |

The provider bound `127.0.0.1:443` **inside** the rootless Podman/QEMU network-isolated guest. Two independent browser flows per round carried distinct PKCE states and cookies. The provider's two-party rendezvous held both `/user` replies until both simultaneous gateway callbacks reached it. Real gateway → root broker → per-UID daemon → fake native `gh`/`git` handoff ran after release. The first round had two callbacks for numeric ID `100000001`; both returned 303 with the same UID 21032 and one immutable binding/account. The next round simultaneously used IDs `100000002` and `100000003`; both returned 303, with distinct UIDs 21033 and 21034 and exactly one binding/account for each. The guest required session and snapshot success and state-replay refusal, then wrote per-UID workspace markers and required all three browser snapshots to contain only their own marker. It checked foreign home/socket EACCES and protected credential mode/owner. The host's acceptance parser requires the two exact `[303,303]` status arrays, all true assertions, and the three-UID inventory; the offline negative oracle rejects missing assertions or failed status arrays even with optimized Python.

This proves simultaneous **gateway callbacks**, not simultaneous broker admission timestamps, every scheduling interleaving, actual GitHub, or a callback loser returning a typed retryable error. In the same-ID round both callbacks succeeded idempotently; no loser retry was necessary. A sequential sibling-account rerun and other earlier scopes remain documented separately.

## Failures and correction

The first invocation stopped before boot (`missing_go` on the shell PATH); a disposable PATH pointing at the already available Go 1.27.1 toolchain allowed subsequent runs. An initial boot returned a rejected/missing proof after 221 seconds without a preserved diagnostic. The next red guest exited 2 after 223 seconds (`distinct IDs did not both succeed`); its host validator initially lacked a bounded reason and was changed to preserve a private serial diagnostic on failure. A further red attempt reported `[303,503]` with three bindings, then one reported `[503,503]`, both `native_adapter_error`, both protected credential files present and three bindings. Those runs did **not** prove successful distinct-ID callbacks and were not counted as passes. Their private debug logs live in ignored `.cache/vm/jit-concurrent-debug.*` (mode 0600), not in git or the public receipt.

Inspection of the disposable native `git` stand-in found it explicitly allowed only the first two UIDs; the third synthetic account could install a credential but its `git credential fill` failed, causing a 503 after handoff. The stand-in was extended to permit the third guest UID and its rendered bytes checked offline. The later clean committed guest above then passed without loosening callback acceptance or replay/route checks. The earlier `[503,503]` B result is not independently explained; it could be a different transient handoff failure under contention. One successful pass does not establish repeatability under all schedules. The binary's product authorization logic was not changed by this fixture correction.

The first independent `/llm-review` finder (`claude-fable-5-1`) caught an unconditional `retryable_loser` success flag and a vacuous early cross-route assertion; both were removed. The final guest requires two 303 statuses for each round and checks non-vacuous mapped workspace markers later. Independent verifier `gpt-6-astra` refuted the remaining proposed barrier-reset and web-serving defects in the bounded scope; it correctly treated the earlier distinct-ID failure as red, not a green concurrency proof, and found no archive-provenance bypass. Review assessment lives in ignored `history/`. No out-of-plan issue was filed: unresolved crash/reconciliation and broader drift are already tracked by this still-open parent, and a hypothetical broker/gate interleaving was not observed.

The required clean CI and separate static guest receipts are recorded below after they complete. No closure or deployment follows this bounded proof.
