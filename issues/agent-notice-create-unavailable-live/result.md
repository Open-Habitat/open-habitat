# Result

Implementation ready; issue remains **testing** until Jari's live one-call retest.
The worker did not create a live notice, deploy, or change Fleetrepo/the VM.

## Root cause and evidence

The live own-user daemon and CLI both report release `e78727081ccc6f51b347ffb5177b198abe12bd41` (pilot.339). The agent socket is owned by its person, mode 0600; native notice listing succeeds with an empty list.

The mutation gate probes `/etc/open-habitat/upgrade-closed.next` and then the final name. On the live installation `/etc/open-habitat` is root:gateway **0750**: the mapped daemon UID gets **EACCES (13)** on both lookups, although neither marker exists. The gate correctly fails closed, but consequently rejects every agent mutation before native work. A read-only `OPTIONS /agent/v1/notices` through that person's agent socket returns **503 / host_maintenance**, confirming that path. CLI error mapping hid that code behind the generic uncertain-write message. This was not a PATH, current-context, socket ACL, Pi persistence, or conversation-title defect.

The live `/opt/open-habitat` ancestor is root:root **0755**; the same mapped UID can establish **ENOENT (2)** for both marker names there. No live content or credentials are included in this result.

## Change

The root upgrade operator now publishes a public **agent mutation fence** at `/opt/open-habitat/upgrade-closed`, while retaining the existing `/etc/open-habitat/upgrade-closed` cold-start fence. It publishes the stable cold fence first and removes it last. Both publication names of both fences participate in recovery/completion checks. This is the same root-only close authority with two visibility requirements, not a second state store: mapped UIDs cannot search the private gateway config ancestor, and an interrupted upgrade can still boot the predecessor's cold guard through `current`. The gateway's private configuration permissions and cold-guard path are unchanged. Permission/I/O failures still deny; staged denial still precedes each final-name probe.

Agent denials now emit a fixed JSONL reason (`upgrade_closed` or `upgrade_fence_unavailable`), without request text, native errors or credentials. The CLI preserves `host_maintenance` and explains that the gate refused before native work, rather than claiming an uncertain write.

## Regression and validation

The original native fixture passed because it omitted the protected config ancestor. Giving that fixture root:gateway 0750 reproduces the exact live CLI failure in **33 ms**, before the fix: [native-red.txt](native-red.txt). With the changed gate, the real Pi + production CLI performs exactly one native bash call and persists the first notice. Staged and published fences each refuse without a native notice; removal allows one-call persistence again: [native-fixed.txt](native-fixed.txt).

Passed on base `09f71591` plus this issue's changes:

- Pi SDK fixture install (`npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`) and web dependency install.
- `./scripts/test-focused.sh --area web`: 92 files, 534 tests, plus static checks.
- `go test ./internal/daemon ./internal/cli ./internal/host ./internal/bootguard ./internal/entryfence -count=1`: all passed (daemon 88.392 s).
- `./scripts/test-native-pi-notice.sh`: all four fence phases pass under the real nonroot kernel UID, with production socket trust intact.
- `TestUpgradePublicFenceNative` in a disposable rootless, networkless Ubuntu container: production root publication/removal and both hot/cold readers agree; staged evidence cannot be removed as a completed fence.
- Focused contracts and `python3 test/vm/test-host-upgrade-fixture.py`: passed. The latter is offline recipe/receipt validation, not a VM upgrade proof.
- Project-view validation and `git diff --check`: passed.

Logs: `/var/tmp/live-notice-{go,web,contracts,upgrade-fixture,root-fence}.log`.
No UI, Storybook, CSS or contracts changed, so there is no affected browser/a11y interaction or visual/prototype delta to capture. Browser suites and screenshots were not run; existing notice presentation is unchanged. No full clean gate, installed systemd upgrade/reboot, live provider, or postdeployment write acceptance is claimed.

## Review

One targeted reviewer (`claude-fable-5-1`, same thread as diagnosis) found that moving the cold marker would let the predecessor's guard miss it on a reboot before selector activation. Confirmed from the immutable-successor owner and `current`-selected boot guards; fixed by retaining the stable cold marker and adding the public own-UID fence. Root regression covers the cold-only publication interval and refuses partial removal when either staged marker exists. The same reviewer checked the revised dual-fence diff and found no remaining concrete defect; locally verified its interruption/recovery reasoning against `open`, `finishAccepted`, `installPolicy` and the staged-marker tests. Raw reviews: `/var/tmp/live-notice-{final-review,dual-review}.txt`. Focused self-review found no notice/title/UI scope drift.

## Recovered tool/workflow failures

- Initial process-skill/source path probes used nonexistent paths. Read the actual installed process skill and concrete source files; no source changes were lost.
- Some shell reads after VM inspection inherited Fleetrepo's directory. Corrected all product commands to an explicit worktree `cd`; Fleetrepo and the VM were not modified.
- Initial read-only notice-list probe omitted `--conversation`, then used the documented flag successfully. The helper captures stdout only, so subsequent diagnostic probes explicitly captured CLI stderr.
- Intended red regression failed with the reported live error, then passed after the fix.
- `issuectl skill print issue --json` was rejected; `skill print --json` returned raw Markdown (not a JSON envelope), so a JSON parse probe failed. Read help/current skill output instead; no global skill install or machine-state change.
- Tracker rejected open→testing; used its required open→in-progress→testing transitions.
- A log-existence probe ran before its test process completed; used the process completion notification and final logs instead. Staged diff checking caught trailing spaces in the captured red failure; stripped only trailing whitespace from that synthetic log.

## Remaining acceptance

After the conductor deploys this tree, Jari must ask a fresh native Pi conversation to create one notice and check one-call success. The original checklist is split to keep this live criterion unchecked rather than claiming it from a synthetic test. No live mutation was authorized for this worker.
