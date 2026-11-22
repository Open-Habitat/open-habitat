# Result

Implemented direction C and the permanent-setting decision of 22 November 2026.
Night quiet now follows the device's local clock, not dark mode. Settings › Sounds
starts with the current night-silence status, an action to turn night quiet off
permanently, and a link to its hour choices. The account menu reads the same
clock-based state without changing its order. Listening and Test sound explicitly
explain their night bypass while night quiet is active. Everything remains behind
`attention-sound`.

The existing account preference owns the on/off choice and the new hours. Old
files keep their choice and adopt 22–7 without being rewritten. Device mute and
volume remain browser-local. The clock is read again for every incoming reply;
silenced replies are not replayed at dawn. Mounted status updates at minute
boundaries and on focus/visibility return. Wall-clock hours handle DST without
adding an elapsed overnight duration.

## Decisions for later review

- Kept the prototype's whole-hour menus: start 18–02, end 04–11. Arbitrary
  minutes or a full-day range would add choices outside the accepted prototype;
  these disjoint ranges also avoid an ambiguous equal-start/end window.
- Kept one account-wide window interpreted in each device's local time, rather
  than adding a per-device preference store or a fixed account timezone.
- The reusable `SoundStatus` component currently shows night only. Device mute
  and off-everywhere retain their existing notes pending the separate design round.
- The permanent-off action says exactly what it changes; no one-night state or
  override exists. It moves focus to the persistent night row before writing,
  so the disappearing status cannot strand keyboard users.

## Verification

Implementation based on `9c78eac548150e214a8bc58d391f5c9c433d8ec8`; the implementation
is the commit carrying this result and its `Fixes-Issue` trailer. All final checks
ran on the completed sources, with `umask 077`, bounded timeouts and a shared
scratch lease.

- `TZ=Europe/Helsinki ./scripts/test-focused.sh --area web`: **255 files,
  2154 tests passed**, plus Biome, TypeScript and catalog checks. Clock tests cover
  inclusive/exclusive boundaries, midnight, after-midnight starts, spring/autumn
  DST dates, mounted boundary updates, resume, per-reply gating and no dawn replay.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: **passed**
  (278.466 s). After the final catalog/comment changes,
  `GOFLAGS=-run=TestAccountPreferences` with the same focused command also passed.
  Tests cover legacy on/off migration, midnight persistence, default elision,
  merge preservation and invalid wire/stored hour rejection.
- `./scripts/test-focused.sh --area contracts`: **passed**, including generated
  fingerprints and 109 schemas / 174 fixtures / 44 scenarios.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15300 ./scripts/test-focused.sh --area browser
  --spec attention-sound.spec.ts`: **5 passed**. Synthetic host-backed checks cover
  theme independence, clock transitions, editable persisted hours, preview bypass,
  menu state, permanent disabling across reload/the next night, retained focus,
  Axe checks, and Explain-mode navigation versus blocked permanent changes.
- The same named spec rerun with `npx playwright test tests/attention-sound.spec.ts
  --repeat-each 3`, two workers and 0–60 ms reply jitter: **15 passed** (1.5 min).
- Explain cards AS07–AS09 exercised in Finnish and US English at 1440 and 390
  pixels. Inspected the synthetic captures; the status fits the first phone
  screen and no horizontal page overflow was found.
- `python3 scripts/generate-ui-reference.py --check`,
  `python3 scripts/validate-project-view.py`, `issuectl doctor --json` and
  `git diff --check`: **passed**.

Early browser runs exposed test-navigation mistakes (the account trigger is
hidden in compact settings), a hover into blank title space, and a genuine focus
loss after disabling night. Corrected these rather than accepting partial runs.

## Review and evidence

Focused self-review plus independent `/llm-review` and `/assess-findings`, because
this changes the preference contract and daemon storage. Finder
`claude-fable-5-2`, verifier `gpt-6-astra`; two calls, routine rigor with a narrow
input/persistence check. Fixed stale experimental-feature copy, made the Test
sound note match the prototype's night-only condition, and reproduced/fixed the
keyboard-focus loss. Corrected a misplaced decoder comment. The alleged initial
preview flash was refuted by the confirmed-feature rendering gate; intermediate
generated drift was regenerated. No unresolved findings or new issues.

Synthetic PNG/HTML pairs, review and assessment are retained outside git at
`/var/tmp/agent-keep/attention-sound-night-clock-impl/`. These are browser/host
fixture evidence, not live deployment, provider or Unix-user-isolation evidence.
No full browser suite or clean gate was run, as instructed. No deployment or push
was performed.
