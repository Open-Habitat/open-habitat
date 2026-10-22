# Recorded skill reader

Implemented the accepted Siru presentation: description-only chip, separate own text, and a modal right-hand reader (540 px desktop, full-screen phone). Back, Close and Escape restore focus; the conversation and draft stay mounted. The reader extends `GoalGuide` through its shared reading surface, with independently scrolling instructions and persistent close controls. Storybook includes recorded and missing-description/long-name states.

## Native source and decisions for later review

- Grounded recognition in installed Pi 1.3.0's `parseSkillBlock` and `_expandSkillCommand` (`dist/core/agent-session.js`). The daemon projects the complete leading recorded wrapper; it never reads today's skill file or keeps an invocation store. Ordinary/incomplete/nonleading mentions remain ordinary text.
- Added optional `skill: {name}` to history entries and their matching SSE payload. The entry's content is the person's extra text; native block zero supplies the instruction, including bounded explicit reads for long instructions. Long extra text uses the existing block reader with a strict `part=skill_arguments` selector and matching response marker, so pasted diffs/logs remain fully readable beyond the entry preview. Projection happens **before** pagination, retaining native block indexes and revision fencing. No new endpoint or authority.
- Removed the recorded location and Pi-generated reference-directory preamble before browser delivery; exact source/directory references within the instruction are replaced with neutral placeholders. No raw-source disclosure is offered, unlike the prototype: the implementation brief explicitly forbids sending internal source paths to the browser. Authored content is still untrusted Markdown, not active HTML.
- Frontmatter is absent from native expansion. The chip uses an existing introductory prose paragraph, stripped of inline markup, or the honest missing-description fallback; it does not invent a summary or consult current installation metadata. The technical name is in the reader, following round 2's description-only chip. Pi warning-only names (including dots/spaces) remain recognized; exceptional names beyond the wire bound get an explicitly ellipsized prefix rather than leaking the wrapper.
- Message copy reconstructs the portable `/skill:name` plus extra text, rather than copying private wrapper metadata (or an empty string for a skill-only message). This is not a claim to recover the exact original slash-command bytes.

## Evidence and comparison

`evidence/` contains eight synthetic host-backed screenshot/static-HTML pairs: 1440 and 390 px, light/dark, closed/open. Compared desktop/light and phone/dark images with the accepted round-2 side-panel prototype: same description-only control, right-facing SVG caret, separated own text, right-hand sheet and phone takeover. The agreed later guide styling replaces the prototype's separate reader styling. The native-path source disclosure is deliberately absent. Other themes and 1366 px are covered by browser assertions.

Validation (disk-backed `TMPDIR=/var/tmp`; browser suites sequential through the installed Cedar warm runner):

- `./scripts/test-focused.sh --area web`: format, lint, TypeScript and unit/component tests.
- `./scripts/test-focused.sh --area browser --spec lab-skill-invocation.spec.ts`: six width/theme cases with axe, Enter/Escape/explicit close/back, focus return, draft/scroll retention, full instruction pagination, missing description, long names and HTTP reload.
- `./scripts/test-focused.sh --area browser --spec start-here.spec.ts`: four shared-guide regression/a11y cases passed.
- `npm run build-storybook --prefix web`: passed.
- `./scripts/test-focused.sh --area contracts`: generated fingerprints and contract validation passed.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon` and `go test ./test/browser-host`: passed. `./scripts/test-focused.sh --area go --go-package ./internal/gateway` also passed, including the exact selector allowlist. Native projection tests cover source omission, UTF-8 pagination, string/array records, recognition boundaries and nonleading ordinary text; SSE validation/entry conversion has a regression test.

These are synthetic same-UID host/browser and package checks, not live-provider, distinct-UID isolation or full-clean-gate evidence. No deployment or push performed.

## Failure inventory

- First browser matrix: all six cases reached the long-instruction reader, then the test incorrectly required the load button to remain present after its final page removed it. Fixed the busy-state assertion to allow disappearance; complete reruns passed. Initial log: `/var/tmp/skill-browser.log`; final log: `/var/tmp/skill-browser-evidence-final.log`.
- The added large-argument browser case initially scoped `last()` inside a relative `has` filter, matching all three messages. Corrected it to select the last matching message; log: `/var/tmp/skill-browser-arguments-selector-failure.log`. This was a test selector error, not a product failure.
- The large-argument browser case then exposed that the gateway's strict query allowlist did not yet accept the new selector. Added the same exact selector there and gateway allowlist regression coverage. The test also waits for settled status and reloads before reading, to retain the native revision fence while Pi appends its reply. Log: `/var/tmp/skill-browser-live-revision-failure.log`. No identity or revision check was weakened.
- The CR/LF-name unit regression initially used event sequence 3 on a fresh sequence-0 cursor, correctly triggering event-gap recovery instead of entry conversion. Corrected its independent fixture to sequence 1. Log: `/var/tmp/skill-web-name-test-sequence-failure.log`.
- AVIF inspection through Pillow failed because its AVIF codec is absent. Recovered with installed `avifdec`, inspected PNG equivalents, and encoded final evidence with installed `avifenc`. No image inspection remains blocked.
- First evidence fetch retrieved all files but cleanup's `rmdir` refused the still-live SSH control socket. Closed that exact temporary master and removed its directory; corrected cleanup and subsequent fetches passed (`/var/tmp/skill-fetch.log`). No service or unrelated process was stopped.
- Tracker closure: the requested `fixed` status was rejected (`transition-illegal`: bug-only; features complete as `done`). Closed as `done`, preserving the correct feature type and both checked acceptance criteria. This fulfills delivery closure without misclassifying the work.
- Staged `git diff --check` found trailing whitespace in browser-serialized snapshot CSS/removed-script gaps. Normalized those inert HTML lines without changing layout; the staged check then passed.
- Discovery probes for `contracts/v1/conversation-history.schema.json`, `web/src/app/events.ts` and `.hb-exec.json` found no such files. Used the actual `history.schema.json`, `conversationEvents.ts`, and installed ordinary-command routing; no required input remained missing.

## Focused review

One independent targeted reviewer, `claude-fable-5-1`, examined the daemon/history, contracts and reader diff (`/var/tmp/skill-review.txt`). Locally verified and fixed three findings: Pi loads warning-only skill names, argument tails beyond 16 KiB needed their own bounded read selector, and the chip's accessible name must include its visible description. Added regression coverage at those boundaries. The fourth finding (an accidental nested schema insertion) was already removed before the review returned; checked the final schema directly. The same reviewer's narrow follow-up found one carriage-return mismatch between recognition and the schema. Matched Pi's exact name/location recognition and made the bounded display name an inert string, rather than imposing an artificial filename grammar on native content; added CR/LF regression input. No unresolved finding remains.

The reviewer's attempted broader daemon tests reported a missing SDK fixture, including on its baseline comparison. Those attempts are not passing evidence; this worker installed the pinned fixture and ran the complete daemon package successfully, then reran after the final fixes. It did not delegate another review or run browser tests; the worker's full affected browser matrix supplies that evidence.

Final counts: 89 web test files / 500 unit-component tests; 6 skill-reader browser/a11y cases; 4 shared-guide browser/a11y cases; contract validator (63 schemas, 68 fixture files, 40 scenarios, 17 negative checks); daemon, gateway and synthetic-host packages; Storybook build. All passed. Final logs are `/var/tmp/skill-{web,contracts,go,gateway,host}-final.log`, `/var/tmp/skill-browser-evidence-final.log`, `/var/tmp/skill-guide-browser.log`, and `/var/tmp/skill-storybook.log`.
