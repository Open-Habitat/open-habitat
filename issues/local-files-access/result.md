# Local files landing result

Origin: taskfleet `01m5crycxewq7vjgwrkx7wrpg3`.
Recovered feature `5461551d` and persistence-test/evidence commits onto main
`aaa7aab6`; deliberately did not replay the obsolete tmux patch `d340f8c1`:
main already carries the tmux 3.4 parsing and lingering-fixture fixes.
Worker follow-ups: `6c2c8ef6` (review repairs), `b3a6d28f` (browser fixture).
No push, test-server access, deployment, installation change or Fleetrepo edit.

## Reload diagnosis and fix

This was a **native Chromium process crash, not an application logout**.
Initial maintained runs reproduced the DevTools `Runtime.callFunctionOn:
Internal server error, session closed`. Targeted synthetic diagnostics showed
Alice's authenticated startup and a 200 snapshot after reload, followed by
Chromium exiting with **SIGTRAP**, with no renderer `page.crash` event.
A minimal page on `/fixture/provider` (no application JavaScript) that stored an
OPFS directory handle in IndexedDB, reloaded, and read it back crashed the
same way, without even querying permission. Full Chromium headless and the
headless shell both crashed in Playwright's off-the-record contexts.

The identical minimal reproducer and full application journey both passed
using full Chromium with a **fresh normal-profile context**. The final spec
therefore uses a disposable synthetic profile per case via
`launchPersistentContext`, removed even when launch/use fails. It still uses
native handles, real IndexedDB serialization, real production restore logic,
and real permission re-query. No permission query, persistence assertion or
restore path was bypassed. No production timing/reload workaround was added.
The final test also asserts identical web identity and CSRF across reload,
and waits for the delete transaction before reloading after revoke.

Temporary CDP/stderr instrumentation, the bare reproducer and the failed
assertion-retry experiment were removed. The retry experiment could not work:
the browser itself had exited. The normal-profile diagnostic run passed all
three cases including the bare reproducer; final two-case verification is
recorded below (both cases pass).

Limits: this is synthetic Chromium/OPFS normal-profile evidence, **not** a real
OS directory-picker permission prompt, a Chrome persistent-grant UI choice,
Brave/Edge/macOS runtime proof, or distinct-UID isolation evidence. The host
route still uploads only requested files through the person's attachments.

## Independent critical review and assessment

Two read-only calls: `claude-fable-5-1` finder and `gpt-6-astra` verifier.
Critical review was proportionate because this feature adds an authenticated
browser reply route, identity-keyed native handles and own-user file uploads.
Inspected the full feature diff and adjacent gateway/session/proxy, daemon
trusted-peer/claim/attachment and browser journal/generation/CSRF guards.
No reachable cross-identity or Unix-user authority bypass was found statically.
This does not substitute for distinct-UID execution evidence.

Assessment: two confirmed occasional-impact FIX findings, both repaired:

- A filename unsupported by the daemon invalidated its entire listing page.
  Browser filtering now matches the daemon's UTF-8 byte/character boundary
  before pagination counting; fetch uses the same validation. A regression
  mixes newline, backslash and over-255-byte names with more than 200 valid
  entries, checks both pages and refuses an unsupported fetch.
- An uncertain slow-upload timeout misleadingly asked for another folder
  grant. Advice now explains timeout and possible completed upload, without
  recommending re-grant or automatic retry. Native socket regression checks
  the uncertainty message and absence of a success receipt.

The proposed new deadline state machine was rejected: a size ceiling is not a
speed guarantee, finite waits are legitimate, and changing two timers would
miss the HTTP/native caller deadlines. No review issue was filed. Final
normal-profile fixture received focused self-review: isolated generated home,
real browser API, cleanup in nested finally, no live profile or global config.
Review/assessment scratch: `history/review-local-files-land.md`,
`history/assessment-local-files-land.{json,md}` and raw finder/verifier outputs.
Model-performance logging was disabled to honor this worker's no-push and
no-Fleetrepo-edits brief; no required review call was skipped.

## Maintained evidence

Commands use `TMPDIR=/var/tmp` and the maintained remote ARM64 runner.
Go/browser jobs prepare pinned Pi fixture dependencies through the declared
runner tasks. Go commands used `umask 077`. All tests use synthetic identities,
homes and browser profiles. No full clean gate or release receipt was claimed;
worker landing uses all affected focused boundaries, per current TESTING.md.

- `./scripts/test-focused.sh --area web`: initial and post-review runs pass.
- `./scripts/test-focused.sh --area contracts`: passes.
- `./scripts/test-focused.sh --area go --go-package ./internal/gateway`: passes.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passes,
  including the formerly failing tmux lingering fixture on tmux 3.4.
- `./scripts/test-focused.sh --area browser --spec attachments.spec.ts`: passes.
- `TMPDIR=/var/tmp node --test internal/daemon/pi-device-test/local-files.test.mjs`:
  dependency-free socket/extension regression passes after review fixes.
- Lightweight Biome checks of changed TypeScript and `git diff --check`: pass.
- `./scripts/test-focused.sh --area browser --spec local-files.spec.ts`:
  final **clean committed** `b3a6d28f` / tree
  `6f9ad6aa61d723e96cbcfbcfccc2f956f171a3c3`: both cases pass, including
  same authenticated session/CSRF and native grant after reload, revoke after
  reload, unsupported-browser explanation, CSRF refusal and Axe.
- Final `./scripts/test-focused.sh --area web`: passes with unchanged runnable
  tree `b3a6d28f`; only this result document was dirty during capture.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, and
  final `git diff --check`: pass. Doctor reports existing unrelated attachment
  size/format advisories, no new issue errors.

Each captured snapshot records its original HEAD/tree/index and dirtiness in
the runner receipt. The table identifies immutable source snapshots, including
intermediate dirty diagnostics; these are not clean-gate receipts. Final
production feature bytes are those in `6c2c8ef6`; only the browser fixture
changes after that. The final fixture is `b3a6d28f`.

| Check | Job | Terminal state | Snapshot SHA-256 |
|---|---|---|---|
| final-web | `d175ead10a4631580fa664b6e9b1fad1c27718809e5dd0b40a8f2e224e39fc6c` | success | `af5ac2e8e0c76eb40183c25167653d6cc7c60173abd352affcb62bc83d10b269` |
| repaired-web | `738a05d3ea11293eb7b465d3641c8da2a868bef70d860d438214b95612b7224e` | success | `0cf9b08d6a2e7cb5b0d0fdcec53bfd5995667d54623b92370bc3540c4b99f732` |
| final-contracts | `a4dcc9e035d615d172b71c39283fd04484a1243e232aee193636f6d4a6dc13dc` | success | `6486f99950bdef5dabe31c64728e54834b472c3185a2de4e7fd792bce442eed7` |
| final-gateway | `da3e6b3c6a8396dc97b38a652fccc7f0aa0d28203c2979c2bd3fe2ba132a4738` | success | `71c0dfa1a09de477f47d15e30cbf140035071b048b163cbb427f65f0ed6ca94f` |
| final-daemon | `69ecf2f5d2241ff35306390ec8e84ddb3cf3ffde0c918d3aa144bb113aea3d17` | success | `1952175d7c9db20776c0f92becbdff72230163d45e4f5469826d0f8727b128de` |
| final-attachments | `bc5ac401b3f823ce910a71cb16801f28a2a69784403b8c9a25944f00bfbc0da5` | success | `55393172459baf89c81217ca605086d9012999791b22400ceea97f60cb7b0a0f` |
| browser-reproduce | `ed2f6acc49fc6c8c5617c74e1cee532fe40dde00373f882a028055881cd550ea` | test-exit | `978c19ed802e100a2173e1d72a40033610b7e62e062b04ce61409f334e3b42fa` |
| browser-diagnose | `0b1965b0c5f5df50c054397e26a5af84b872df5943d85c85c56eba68336fa53b` | test-exit | `9a20ba04b8232ce160f5c54467d8acafd881a17d1e3e63d7fa9973c308c13e01` |
| renderer-handoff | `acda0d8c591d216bdd8a6df1122897c3f466c50e2a3e8dd0df0b6137373a68a1` | test-exit | `5692c741bd94dca0544b9d6abe67c871f586c9e39a34f0d3fc3db3858c76736e` |
| native-browser | `30631c419bf9c00444d5974529a8d02ed9595fbd97a40ec8e828d17be2cd2002` | test-exit | `93eea41869c96de90e324eebf5c9859b387ab43c6cd88da645b9e4af9a91046c` |
| full-chromium | `93aa9b697be11a56f3b399f3ccd7b4e7b3b058bd35599bcee667714d93d8ddeb` | test-exit | `2a1147a1c0096cacd7d2a6b9ac7e0d666308b2f6c3acb82ababfcac12cd5ee87` |
| persistent-profile | `86d8c61858ca247df08b8c73187b45a8f0f2e9f0f597d19b26d911fe2c559abd` | success | `fc11600ffb081c2a4104938a772374ba260390e58eafa55406a0c3e26e72e2f7` |

| final-browser | `3185bcb50b62c6da1ede53dd84f6aaf93499ede20a92b78152be8d6ba24b7361` | success | `263613e2965b5dc8df90822b72583a2fa5b98509aec3f20859aa056e90069e90` |
| final-web-clean | `dedab15e34dde2141dd16b37a5c45c90bbb35726c1c93a30703875a95815513a` | success | `43bace21686bf3196354ae3e12066815f1ec9612121da535125b584dda59bb35` |

## Failure/incomplete-command inventory

Five intermediate browser jobs failed while diagnosing the same native
SIGTRAP: initial reproduction, event diagnostics, CDP/retry diagnostics,
application-free headless-shell reproduction, and full-Chromium incognito
comparison. These are genuine failures, not passes; normal-profile runtime
verification supersedes them without skipping handle persistence. The
transient-DevTools-session hypothesis was refuted by the process exit logs.
No other maintained area check failed in this run. Queue delays were observed,
not counted as passes; no local heavy-test fallback was used.

Auxiliary failures: one wrong skill path (correct skill subsequently read),
one wrong error-context artifact path (archive subsequently extracted and
read), and log-inspection shell commands returned nonzero for not-yet-created
later-stage log files. A lightweight Biome diagnostic warning for an unused
catch parameter was corrected; diagnostic code was later removed entirely.
A displayed runner-log tail was truncated mid-JSON during final inspection; immutable fetched receipts supplied the complete terminal/source identity evidence instead. None omitted a required check. No subworker was launched or left running.

Visual captures were deferred under the worker brief's Alder lab/capture
restriction; focused host-backed browser and Axe checks cover the affected
interaction. No live screenshots, real profiles or personal files were used.
No product installation/Fleetrepo change is needed for the delivered feature.
