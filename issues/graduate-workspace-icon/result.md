# Result

Workspace icons, picker and suggestions are always available. Removed the card,
settings-index row and preference gate. Tests exercise the default state instead
of toggling the feature; obsolete icon-off presentation branches were removed
from browser coverage (icon-source, write, undo and layout coverage remain).

## Evidence

On Birch, `./scripts/test-focused.sh --area web`: 179 files / 1352 tests passed.
Focused browser specs with `OH_PORT_BASE=15300 OH_BROWSER_WORKERS=2`:
`lab-workspace-icons.spec.ts` (1), `lab-workspace-icon-setting.spec.ts` (1),
`lab-workspace-icon-suggestions.spec.ts` (2), `rail-icons-quiet.spec.ts` (4),
and `settings-experimental.spec.ts` (3), all passed. Implementation through
`4db5c4430`. These cover config → favicon → glyph, picker writes, suggestions,
no undo for an absent icon setting, undo for an existing setting, quiet-list
layouts and accessibility. Synthetic native files/fake model, not live-provider
or UID-isolation evidence. Focused self-review; no daemon/contract change.

## Integrated verification

After rebasing onto the other round landings, `c9ea766de` passed the focused web
check (180 files, 1370 tests) and all ten affected browser specs (26 cases):
next-waiting-row, settings-experimental, start-page-request, start-here,
server-settings-area, live-conversation-limit, lab-workspace-icons,
lab-workspace-icon-setting, lab-workspace-icon-suggestions and rail-icons-quiet.
Same focused commands and port/worker settings as above. The only rebase conflict
was the shared KOKEILTAVAA list; both workers' additions were retained. Final
focused self-review found no remaining flag reads for the four graduated features.

## Decisions for later review

- Kept Kumoa limited to a previous explicit setting, including explicit `auto`.
  An automatic favicon with no icon line has no exact previous value the current
  write operation can restore. Writing `icon: auto` restores the visible source
  but is not equivalent: it suppresses suggestions permanently, whereas an absent
  setting allows them. The alternative is a new remove-setting operation with
  its own native-file semantics. That is not needed for this graduation, and
  Jari said the missing undo did not trouble him. The existing no-previous-setting
  and explicit-setting undo assertions pin this distinction.
