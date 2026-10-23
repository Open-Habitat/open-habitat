# Result

The agent's native tool PATH now includes the shipped CLI. An absolute launch
selector is retained only when it reaches the same executable, so long-lived
shells/editors follow upgrades; relative/missing/foreign argv cannot redirect it.
Personal tools retain precedence. No home wrapper, profile or instruction store
was added. Pi's existing host prompt now supplies the complete one-call notice
recipe, inline UUID generation, persistence result path and safe retry rules.

Notices now have the existing keyboard-operable ControlButton close control.
Dismissal hides the mounted card, not its native history entry. Storybook shows
the production component's persisted, failed-write and uncertain states.

## Acceptance and first-write investigation

`test-native-pi-notice.sh` first reproduced `open-habitat: command not found`.
Afterward a fresh real Pi 1.3 session receives the Finnish reminder request; its
synthetic model executes the recipe extracted from Pi's actual system prompt.
**One native bash call** resolves the production CLI through the launch selector
and creates the notice. Its **first response is persisted**, and the native
history reader finds exactly one notice with the requested text. The networkless
rootless container's PID 1 creates the real fixed-path socket; production CLI
socket-trust and own-UID daemon checks remain active. See `native-pi.txt`.

The earlier reported nonpersistent first write did **not** reproduce with the
pinned SDK. There is no evidence here justifying a native-writer change. Guidance
now identifies `data.result.notice.persistence`, reports uncertainty honestly
and forbids automatic new-key retries. No live history or personal credentials
were read to reconstruct the earlier occurrence. A synthetic model proves prompt
delivery/execution, not every real model's language understanding.

## Verification

All passed on base `de79437516a822c341b6cb54f18f80de9400bbc4` plus this commit's code:

- Both npm dependency installs, including the real Pi SDK fixture with `--ignore-scripts`.
- `./scripts/test-focused.sh --area web`: format/lint/typecheck, 533 tests.
- `go test ./internal/daemon ./internal/cli -count=1`: 84.128s / 0.075s.
- `./scripts/test-native-pi-notice.sh`: real Pi, production CLI, one-tool first write.
- Focused browser `agent-notices.spec.ts`: 2 passed; native/transient scope, inert text, dismissal and persisted-history preservation.
- Focused browser `lab-agent-notices.spec.ts`: passed; keyboard dismissal and axe at 1280/390 px in both themes.
- Focused contracts, Storybook build, issuectl doctor, project-view validator and `git diff --check`.

Browser suites ran serially through Cedar. Logs are
`/var/tmp/notice-{web,go,native,browser,lab-browser,contracts}-final.log` and
`/var/tmp/notice-storybook.log`. No full-gate, live-provider, installed-systemd or
production-isolation claim; the conductor owns the round's clean gate.

## Review and visuals

One targeted reviewer (`claude-fable-5-1`) caught the initial resolved-binary-only
PATH pinning shells to old releases. Confirmed and fixed with the verified
absolute launch selector; native and unit regressions cover it. No remaining
concrete finding. Raw review: `/var/tmp/notice-review.txt`; local assessment:
`history/review-agent-notice-discoverable.md` (ignored scratch).

`attachments/notice-{1280,390}-{light,dark}.{avif,html}` pairs show the synthetic
lab's transient notice (its warning is intentional). All four were visually
checked against existing extension-card styling and ArchiveNotice's close-control
idiom; no notice-specific prototype exists in current drafts. Shared tokens and
fonts remain intact; phone text and the close control fit without overflow.
These are review captures, not automated visual comparisons.

## Decisions for later review

Dismissal is presentation-local: reloading can show the native notice again.
Permanent dismissal would require a new record/native format, which was not
requested. A live unprompted model retest remains useful after deployment; replace
the older KOKEILTAVAA notice item with this issue and check one-call creation,
closing, and preserved history after reload.

## Recovered tool/workflow failures

- Wrong initial process-skill path and optional source/AGENTS globs: used the provided skill and actual source/parent instructions instead.
- Native fixture private-runtime failure: set umask 077 inside container PID 1; dependency-read failure: publish only disposable fixture copies as readable. Later selector-parent permission failure: explicitly publish that fixture directory as 0755. Final native check passes.
- Intended red regression: command-not-found before the PATH fix; green afterward.
- Biome nested-root failure: invoke from web; specificity lint: use a named label class. Final web checks pass.
- Initial lab case used an ordinary-history workspace that lab removes: use the existing live-notice lab fixture; ordinary-host coverage separately proves persisted dismissal/reload. Both final suites pass.
- Unsupported `taskfleet --version`: corrected to `taskfleet version --output json` (0.16.0). Browser artifacts are remote, not missing: fetched successfully. Optional converter probes lacked ImageMagick/ffmpeg/Pillow AVIF; installed avifenc produced the final AVIFs. No required step remains incomplete.
