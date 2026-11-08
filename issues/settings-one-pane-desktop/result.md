# Result

Settings now shows its list and default Account content side by side above
800 px, including fresh `/settings` entries at 801, 900 and 1030 px.
CSS, search preview and section-preserving resize handling share that boundary.
The workspace rail still yields at 1400 px. Phone list/detail stays bounded
rather than expanding into the room freed by navigation.

## Decisions for later review

- Cap the phone list and detail at 400 px. Alternative: let the detail expand
  after navigation disappears, or force each individual control to remain
  stacked using viewport overrides. The cap keeps the existing container-driven
  rows monotonic without duplicating every section's responsive rules. Ordinary
  390 px phones still use their available width; wider phone-mode windows leave
  spare space instead of widening controls again.

## Verification

Base `a47b64eae`, Birch, locked web and Pi fixture dependencies installed.
`umask 077`, fresh disk-backed `/var/tmp/oh-settings.*` TMPDIR,
`OH_PORT_BASE=25900`, `OH_BROWSER_WORKERS=2`.

`./scripts/test-focused.sh --area web` passed static, type, catalog, unit and
component checks. Every settings spec was run by name through
`./scripts/test-focused.sh --area browser --spec NAME`, with `--lab` for
lab-editor-settings:

| Spec | Passed |
| --- | ---: |
| account-settings | 17 |
| lab-editor-settings | 4 |
| recap-settings | 4 |
| server-settings-area | 3 |
| settings-breakpoint | 2 |
| settings-close | 8 |
| settings-experimental | 3 |
| settings-model-picker | 5 |
| settings-name-and-storage | 2 |
| settings-search | 5 |
| settings-selectors | 2 |
| settings-three-pages | 10 |
| settings-width-sweep | 21 |

The breakpoint regression now checks both sides of 800 px, fresh root entries,
list width, selected-content preservation and open/collapsed rail states.
Search previews are exercised at the reported 1030 px width, and list/detail
search at 800 and 390 px. The unchanged all-section width sweep passes.
`OH_VISUAL_CAPTURE=1` on settings-breakpoint produced adjacent 2× PNG/static HTML
pairs at 900, 1030, 1280 and 390 px in light/dark under `evidence/`.
Inspected the 900 light and 390 dark screenshots. These are synthetic lab
captures, not live user data. Focused self-review covered CSS/JS agreement,
phone sizing, route entry, search and server-area navigation; no authority,
daemon or contract changes. No whole suite or clean gate run.

## Development failures

- Initial web check found formatting in the new test; formatted and reran green.
- Search's old 1040 px phone expectation correctly failed; moved the phone case
  to 800 and the existing desktop-preview journey to 1030; rerun passed.
- The server-name spec expected the rail at 1280 despite the already-landed
  1400 px rail fold. Its rail-observation case now runs at 1600; all refusal,
  typed-value, successful update and no-navigation assertions remain. Rerun passed.
- Discovery guessed an absent AppShell.css path, and focused-test --help exits
  2 after printing usage; neither affected the implementation.
- Existing experimental/close specs write screenshots outside this issue even
  without the capture switch. Restored tracked images and removed only the
  exact newly generated files; no other issue changes retained.

Issue doctor initially found the empty directory left by the experimental
spec's captures; removed those empty directories and reran successfully.
Project-view validation and staged whitespace validation also passed.

No new issues filed. Live deployment and visual acceptance remain with the
conductor; the KOKEILTAVAA entry is under Työn alla.
