# Settings selectors

Implemented the accepted **Valikko monelle** direction in shared controls:
language (personal and server default) and recap scope use `ChoiceMenu`;
short settings choices stay non-wrapping row-sized segments. Rows move their
whole control below the label when the pair no longer fits. All `NumberStepper`
uses now have a centred value between row-sized − / +, with the unit outside.
Recent conversations now names its unit in both languages.

## Decisions for later review

- **Recap scope is a menu.** Keeping four segments was the alternative, but
  Finnish *Perusteellinen* plus the other three labels and row-size padding
  cannot fit narrow phone settings content. The previous component already
  required a two-by-two fallback below 380 px. The menu preserves one compact
  field at all widths and makes the existing per-level notes comparable.
- **Theme segments use words without redundant icons in Settings.** Keeping
  both overflowed the card at 320 px in Finnish in the browser regression.
  Words alone fit, retain all three visible choices and match the prototype.
  The account menu's theme icons are unchanged.
- **Menu opening waits for mouse release, like touch.** Opening on mouse-down
  lets the phone sheet cover its opener and consume that same mouse-up as an
  accidental choice. Keyboard opening and React Aria menu navigation remain.
- **Unavailable choice triggers retain focus but block activation** through
  React Aria's pending button behavior. A natively disabled trigger lost focus
  when a selected language began saving; keyboard regression covers this.

## Evidence

Synthetic lab only, invented identities and homes, production components;
not live-host, real-provider or UID-isolation evidence. Captured with
`web/lab/settings-selectors-menu.mjs`, **device scale factor 2**, 1440 px desktop
and 390 px phone. Each PNG has a same-basename offline HTML twin in `shots/`.
Recap captures isolate the custom-number card; their tall viewport prevents
an internally scrolling settings page from clipping the captured content.

| Language / width / theme | Appearance | Open menu | Custom recap |
|---|---|---|---|
| fi / 1440 / light | [PNG](shots/fi-1440-light-appearance.png) | [PNG](shots/fi-1440-light-menu.png) | [PNG](shots/fi-1440-light-recap.png) |
| fi / 1440 / dark | [PNG](shots/fi-1440-dark-appearance.png) | [PNG](shots/fi-1440-dark-menu.png) | [PNG](shots/fi-1440-dark-recap.png) |
| fi / 390 / light | [PNG](shots/fi-390-light-appearance.png) | [PNG](shots/fi-390-light-menu.png) | [PNG](shots/fi-390-light-recap.png) |
| fi / 390 / dark | [PNG](shots/fi-390-dark-appearance.png) | [PNG](shots/fi-390-dark-menu.png) | [PNG](shots/fi-390-dark-recap.png) |
| en-US / 1440 / light | [PNG](shots/en-US-1440-light-appearance.png) | [PNG](shots/en-US-1440-light-menu.png) | [PNG](shots/en-US-1440-light-recap.png) |
| en-US / 1440 / dark | [PNG](shots/en-US-1440-dark-appearance.png) | [PNG](shots/en-US-1440-dark-menu.png) | [PNG](shots/en-US-1440-dark-recap.png) |
| en-US / 390 / light | [PNG](shots/en-US-390-light-appearance.png) | [PNG](shots/en-US-390-light-menu.png) | [PNG](shots/en-US-390-light-recap.png) |
| en-US / 390 / dark | [PNG](shots/en-US-390-dark-appearance.png) | [PNG](shots/en-US-390-dark-menu.png) | [PNG](shots/en-US-390-dark-recap.png) |

## Review and validation

Focused self-review (web-only; no host, contract or authority change): checked
controlled selection and refusal behavior, keyboard and mouse opening,
focus through asynchronous saving, option descriptions and selection semantics,
CSS scoping to direct settings-row controls (not nested model pickers), and
synthetic screenshots. Found and fixed the phone mouse-up selection, native
disabled focus loss, Finnish theme overflow and stacked trigger chevron.
The former four-segment layout assertion is replaced by visibility/bounds
checks for all four menu options, plus Escape focus restoration; it no longer
asserts an obsolete one-row/two-by-two implementation.

During development: focused web passed (161 files / 1185 tests); language
browser spec 9 passed, recap 4 passed, settings search 4 passed, and new
selectors spec 2 passed, with axe checks of the open menu in both languages
at 1440/1040/800/390/320 px. Disabled-menu component regression also passed.
Final integrated checks are recorded below after rebasing.

Initial commands found lint warnings, one catalog function return-type error,
and the interaction/layout defects above; fixed and rerun. An unsupported
`--untracked` flag was rejected by test-focused; rerun without it. Repeated
`--spec` arguments ran only the last spec, so subsequent specs run separately.
UI reference regeneration initially refreshed pre-existing generated excerpts;
main's concurrent regeneration absorbed the unrelated editor excerpts on rebase.

### Final integrated checks

Rebased onto `8d765d2b` (including recap off and the shared tooltip fix).
Resolved the recap conflict by retaining off's disabled scope behavior and
using a row-sized segment for its new automatic on/off row. Kept both sides'
KOKEILTAVAA entries. The initial integrated search run exposed the new
`recap-automatic` row missing from the search index; added its Finnish and
English index entries as a separate recap follow-up commit. A legacy unit
assertion counting theme SVGs was removed: words intentionally replace those
icons, while theme selection/persistence and single-line bounds remain tested.

Final commands, on the rebased implementation with those corrections:

- `./scripts/test-focused.sh --area web`: **162 files, 1194 tests passed**;
  Biome and TypeScript passed.
- `./scripts/test-focused.sh --area browser --spec NAME` (one spec per run,
  `OH_PORT_BASE=10250`, `OH_BROWSER_WORKERS=2`): `settings-selectors` **2**,
  `ui-language` **9**, `recap-settings` **4**, `settings-search` **4**,
  `settings-experimental` **3**, `account-settings` **17** passed.
- `./scripts/test-focused.sh --area browser --lab --spec lab-editor-settings.spec.ts`:
  **4 passed**, including light/dark phone/desktop axe checks.
- The selectors case also opens by touch, verifies checked radio state, and
  uses ArrowDown/End/Enter/Escape with focus restoration through saving.
- All 24 paired screenshots recaptured after integration; selected phone and
  desktop light/dark images visually reviewed. These are review material, not
  automated visual comparisons.

`python3 scripts/generate-ui-reference.py --check`,
`python3 scripts/validate-project-view.py`, `issuectl doctor --json` and
`git diff --check` completed. Doctor reports PNG evidence among the repository's
non-AVIF inventory; no broken references or conflict markers. Closing status is
`done` (the brief has no Acceptance Criteria heading, so issuectl gives its
non-blocking definition-of-done warning).

No full browser suite or clean gate run; the conductor owns those. No live
installation or real assistive-technology session tested.
