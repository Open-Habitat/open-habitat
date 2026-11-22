# Sounds and agent instructions graduation

## Outcome

Both features are ordinary features, without experimental cards or gates.
The workspace strip, Settings › Sounds, the account-menu sound controls,
personal instructions in Settings › Account, and onboarding's final note
are available without opting in. Saved sound choices, device mute/volume,
clock-based night quiet and the all-reasons status line are unchanged.
Instruction writes still use the same compare-and-swap and browser merge.

The dependency's implementation and passing harvest were already in the base
(`65eefe0c3`, `90e8c6c83`, `4ba01820f`). The graduation follows the catalog,
settings-index and generated-reference pattern of `40618dddf`.
There was no daemon-side gate. The only handwritten Go change is a stale
comment; no session, contract, authorization or stored-state implementation
changed.

## Decisions for later review

- **Sounds remain on by default, with night quiet at 22–07 local time.**
  Alternative: off until chosen. The early settings-round notes proposed off,
  but the later explicit decision of 21 November in
  `issues/attention-sound/item.md` says on by default. The implemented defaults
  already match that decision and the subsequent clock-night choice. A saved
  sound-off choice or device mute remains effective; graduation does not reset
  either.
- **Leave retired experimental keys readable but inert.** Alternative: rewrite
  existing preference files to delete them. The existing graduation pattern
  needs no migration: the catalog no longer offers the keys and no UI reads
  them. The retired-choice browser regression still exercises old saved keys.

## Review

Focused self-review, proportionate to a UI graduation with unchanged native
writes and authority. Reviewed all gates and their imports, default/preserved
preferences, onboarding completion, settings search, and generated guide drift.
No independent model review was required or run: session machinery, contracts,
daemon state and authorization boundaries are unchanged.

The review found older tests still using the feature-off pencil dialog or
omitting the final note. They now exercise inline renaming and the ordinary
onboarding note. The inaccessible pencil/dialog implementation was removed.
No whole behavioral test was deleted. Removed assertions only required the
sound UI to be absent with the experiment off or searched for its old switch.
Optimistic rename, refusal, focus, icon editing, onboarding order and completion,
concurrent instructions edits, sound delivery/silence and Explain behavior remain
covered on their ordinary routes.

## Verification

Source under test: `8dbd0f4c9` (the same source bytes were checked before the
implementation commit). Commands ran with `umask 077`, the shared scratch
lease, bounded timeouts and two browser workers. Logs are retained under
`/var/tmp/agent-keep/graduate-sounds-and-agent-instructions/`.

- `./scripts/test-focused.sh --area web`: passed, 256 files / 2,165 tests,
  including static, catalog and component checks (`web.log`).
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`:
  passed (`go.log`), additional coverage despite there being no daemon gate.
- Initial focused browser run: 36 ordinary and 6 lab cases passed
  (`browser.log`).
- Final ordinary browser run with `--repeat-each 3`: **147 passed** without
  retries (`repeat.log`). Specs: `attention-sound`, `agent-instructions`,
  `settings-experimental`, `settings-width-sweep`, `mutation-layer`,
  `onboarding-route-map`, `pi-onboarding-host`.
- Final lab browser run with `--repeat-each 3`: **135 passed** without
  retries (`repeat.log`). Specs: `lab-sidebar-account`, `lab-workspace-page`,
  `lab-workspace-icon-setting`, `lab-explain-mode`, `lab-explain-coverage`.
  An earlier focused run of the latter four passed all 39 cases (`affected.log`).
- Synthetic visual capture: `./scripts/test-focused.sh --area browser
  --spec attention-sound.spec.ts --tag 'all reasons'` with `OH_NIGHT_CAPTURE`
  pointing at the retained `visual/` directory: 1 passed (`visual.log`).
  Paired PNG/HTML files `visual/all-{light,dark}-{1440,390}.{png,html}` show
  the ordinary Sounds route and all three silencing reasons. Inspected the
  light desktop and dark phone images: controls fit and each fix remains
  distinct. Captures stay outside the repository.
- `python3 scripts/generate-ui-reference.py`: regenerated checked-in references.
- `python3 scripts/validate-project-view.py`: passed.
- `issuectl doctor --json` and `git diff --check`: passed.

The repeated browser commands use `npx playwright test` with the explicitly
named `tests/<spec>.spec.ts` files above and `--repeat-each 3`; the lab command
adds `--config playwright.lab.config.ts`. They ran sequentially with
`OH_BROWSER_WORKERS=2 OH_LAB_WORKERS=2 OH_REPLY_DELAY_MS=60 OH_PORT_BASE=20400`
and a fresh leased scratch TMPDIR. Neither a whole browser suite nor the clean
gate was run.

Development failures were resolved: the first web pass exposed the old
onboarding assumptions; initial browser setup lacked the Pi SDK fixture and
was rerun after installing the pinned fixture dependencies; a later ordinary
browser startup found a busy port and was rerun on a separate port range.
None of these interrupted attempts is counted as a pass.

Browser evidence is synthetic, host-backed and same-UID. Sound playback checks
observe the browser's playback record, not audible output. No deployed-server
or real-provider verification was performed.

## Live check

After deployment:

1. With no experimental opt-in, open Settings › Sounds, the account-menu
   sound row and a workspace's strip. Neither feature has an experimental card.
2. Choose a workspace sound and length, mute this device, and set sound off.
   Reload: choices survive. At night, the status lists every active silence
   with its independent permanent fix; a fresh account defaults to on with
   clock-night quiet.
3. In Settings › Account, edit instructions yourself and with an agent. A
   concurrent edit must merge or ask for a conflict choice, never overwrite it.
4. Walk onboarding: the note is its last step, and saving or choosing Later
   leads to entering Habitat. A sign-in started from Settings adds no new route.
