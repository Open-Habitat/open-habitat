# Result

## What changed

Runtime payloads live in a content store, `<prefix>/payloads/<digest>/<profile>`. The digest covers each profile and its authenticated archive SHA-256. A generation is still named after its manifest, but its `payloads` is now a link to the store entry. The selectors (`core`, `profiles/*`, `pi-runtime.json`, `editor.json`) name the entry directly, because the daemon refuses a Pi runtime reached through a symlink. When a release names an archive set that is already published, staging reuses it: no spool, gzip decompression, extraction or fsync.

The store is keyed by the whole set of archives, not by each archive. The integrations Pi wrapper finds core through its physical path (`cd -P` followed by `../../../core/runtime`), so a per-archive entry would have no sibling core to find. When any runtime archive changes, the whole set is extracted again, which is today's cost.

Trust properties:

- **New manifest.** It is still authenticated by its pinned digest before anything is read. The store key comes only from that manifest's archive digests.
- **Reuse is not a receipt.** Before a new generation links to an entry, every file is rehashed against the manifest that now names it, in parallel. The check also re-applies the extraction's content rules (entry-point ELF architecture, npm lock, non-empty licenses) and requires:
  - the exact inventory, with no extra or missing files;
  - exact modes over 07777, so setuid bits count;
  - owner, link count 1, and no `security.capability` xattr;
  - no other file types and no symlinks.

  Files are reopened with `openat2` (`RESOLVE_BENEATH|NO_SYMLINKS|NO_XDEV`) and their dev/ino is compared with the walk.
- **Later checks.** Each later check of a generation (the owner run's stage, then activation before selectors switch, and inspection) rehashes it again. Those checks verify integrity only, so a predecessor staged under older acceptance rules stays upgradable.
- **Atomic publication.** A new entry is staged privately, fsynced, and published with one `RENAME_NOREPLACE`. Selectors still switch through the existing atomic link replacement, and the runtime install keeps its rollback.
- **Collection.** It runs under the operation lock. It removes only entries that no generation's `payloads` link and no selector (`core`, `core.next`, `profiles/*`, the JSON selectors and their `.next`) names. Removal is a rename out of the store before deletion. Anything unreadable stops collection without removing anything.
- **Older installations.** Generations from before the store keep their own payloads, and every check and selector derivation reads both layouts. The first upgrade to this release extracts once into the store; later releases with unchanged runtimes reuse it, with no manual steps.
- **Browser sandbox.** The headless Chromium AppArmor profile now attaches in both layouts. The review found this; AppArmor matches the resolved executable path.

Timings: the upgrade result carries `runtime_payloads`. Per profile, it reports the outcome (`reused`, `verified` or `published`) with `verify_ms`, or with `authenticate_ms`, `preflight_ms`, `extract_ms` and `sync_ms`.

## Chosen reuse check and why

A full content rehash against the new manifest, not a metadata comparison, a recorded ctime/inode receipt or the directory's existence. Rehashing needs no decompression, writes or fsync, so it costs a small fraction of extraction. It is the only check that detects an accidental change to content, extra files or a lost mode bit without trusting state recorded earlier. On the measured tree it takes 0.4 s with a warm cache and 1.7–8 s cold.

## Measurements

These are local and synthetic, not the test server. The core archive is synthetic: 22,585 files, 557 MB compressed, 1.66 GB expanded. The harness is `installRuntime` on a disposable prefix, with three releases naming the same archive. Evidence and the harness are in `/var/tmp/agent-keep/runtime-republished-every-release/`.

| | 1st release | 2nd release, same runtime | 3rd release, same runtime | Disk after 3 releases |
|---|---|---|---|---|
| main (eed117ca) | 22.0 s | 32.6 s | 29.9 s | 4931 MB |
| this change, warm cache | 17.0 s | 0.43 s | 0.38 s | 1643 MB |
| this change, caches dropped before each reuse | 18.0 s | 1.78 s | 1.69 s | 1643 MB |

The first-release time is the same work in both builds; the spread between runs is machine noise. In a host upgrade with an unchanged runtime, stage reuse replaces extraction plus fsync. The owner run and activation each reread the payloads once (sub-second to a few seconds), and services restart as before. The end-to-end figure against the 100 s budget has to come from the conductor's live measurement. The first upgrade into this layout still extracts once.

## Checks run

- `./scripts/test-focused.sh --area go --go-package ./internal/host`: pass. New tests cover the reuse refusal classes (content, mode, setuid, extra, missing, empty license, hard link, symlink, directory mode, FIFO), the binding to the new manifest, collection with an unreadable generation and with selector-only references, both layouts, entry-set naming and the directory bound.
- `scripts/test-host-initialization-uids.sh` (rootless podman, root inside, networkless): pass. This includes the apply/upgrade selector switch from a legacy-layout predecessor to a store-layout successor, and the integrations wrapper's relative walk to core.
- `apparmor_parser --skip-kernel-load -Q` accepts the updated profile. I did not test attachment on an enforcing kernel.
- `python3 scripts/validate-project-view.py` and `git diff --check`: clean.
- No release script changed, so the `test-package-*` scripts (product package) do not apply.

## Review

Critical-rigor `/llm-review`: GPT-6 Astra as finder, Claude Fable 5.2 as a focused false-negative probe of the trust and collection boundary. I chose it because the change touches release trust and root installation. The probe found no path that references or selects an entry without a fresh check, and no unsafe collection path. Three confirmed defects were fixed: the AppArmor attachment, an unsound directory bound, and leftover collection trees. `/assess-findings` gives FIX 3 (applied), DISCUSS 1, DROP 2.

## Decisions for later review

- **Set-keyed rather than per-archive store.** The alternative was a per-archive entry, which would also reuse when only one pin changes. That needs a wrapper change in the integrations archive (it resolves core by relative physical path), and existing archives could not be shared until then. I kept the set key because the observed case (every archive unchanged) is fully covered.
- **A corrupt store entry is never repaired automatically.** Every release that names that set is blocked until the operator removes the entry, as `docs/operations.md` describes. The alternative was to re-extract over it, which could move a tree the live selector names.
- **Same-release profile changes.** Re-applying the same release with fewer profiles now fails closed, where the legacy subset check passed; adding a profile already failed. The alternative is to bind the link to the generation's recorded site profiles. I left it because it is not clear that the operation is supported.
- **Payload timings appear in the upgrade result, not in apply's result.** Apply is the initial installation, where reuse rarely applies.
- **The operator's separate `runtime-release verify` before an upgrade is unchanged.** It still decompresses every archive (about 34 s on the test installation). Host upgrade staging already authenticates and preflights every selected archive it extracts, and rehashes any reused tree. Dropping or narrowing that operator step is the operator's decision, not a product change.
