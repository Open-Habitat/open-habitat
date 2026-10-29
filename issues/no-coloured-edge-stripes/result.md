# Result: no coloured left-edge stripes

## What changed

Every coloured left-edge accent in `web/src/` is gone; state and emphasis now
come from the icon/text that was already there, a soft surface, or a full 1px
border in the state's `--ah-*-line` token.

| Place | Before | After |
| --- | --- | --- |
| Failed tool row (`components.css` `.ah-tool-row.ah-tool-error`) | 3px `--ah-err` left border | rule removed: same border as a successful row |
| Notices, connection, question, unknown, uncertain, receipt, operation, error summary (`components.css`) | 5px left border in tone colour | 1px tone border all round |
| Settings row landing highlight (`Settings.css`) | accent inset stripe + soft background (static stripe under reduced motion) | soft background only (static soft background under reduced motion) |
| `.sk-notice` (`SiteKeySettings.css`, used by Spinoffs) | 3px accent left | 1px `--ah-accent-line` border, `--ah-r-md` |
| `.ig-warn` / `.ig-notice` / `.ig-expect` (`Integrations.css`) | 3px err / grey / 4px accent left | 1px `--ah-err-line` / `--ah-line` / `--ah-accent-line` |
| stderr lines (`ProcessTray.css`) | 2px grey inset stripe | removed; the `stderr ·` prefix already marks them |
| Editor merge lines and conflict card (`BrowserEditor.css`) | 3px ok/err inset stripes; dashed ok stripe for pending | tinted line background only; pending is a hatched `--ah-ok-soft` band |
| `.ah-replace-note` (`EditorReplaceNote.css`) | 3px err left | 1px `--ah-err-line` |
| Home cards, new reply / waiting (`HomeWorkspaces.css`) | 3px accent left | 1px `--ah-accent-line` border; the dot stays |
| Worker view frame and prompt (`Spinoffs.css`) | 3px accent inset on the whole frame; 3px ink start border on the prompt | removed; the accent band says whose conversation it is |
| Onboarding `.ob-notice`, `.ob-effect`, `.ob-access` | 3px accent/err left; 2px grey left | 1px accent/err line border, `--ah-r-md`; `.ob-access` plain muted text |
| `.si-effect` (`ServerIntegrations.css`) | 2px grey left | sunken surface, `--ah-r-sm` |

Kept: neutral 1px panel dividers, the markdown and thinking blockquote rule
(typography of native content), the turn timeline rail, and the tool group's
full error border. The rule is recorded in `design-system/design.md`
(Ilme ja luettavuus).

`Catalog.stories.tsx` Conversation now includes a failed `bash` row (its tool
group already claimed "1 virhe") so the failed state has a catalog fixture.

## Evidence

Synthetic Storybook catalog (static build, before = this branch's story with
the original CSS, after = this change), device scale factor 2, light and dark,
1280 px and 390 px wide: [evidence/before/](evidence/before/) and
[evidence/after/](evidence/after/), files `<place>-<theme>-<desktop|390>.avif`.
Main ones: failed tool row
[before](evidence/before/tool-row-failed-light-desktop.avif) /
[after](evidence/after/tool-row-failed-light-desktop.avif) /
[after dark 390](evidence/after/tool-row-failed-dark-390.avif); Integrations
warning [before](evidence/before/ig-warn-light-desktop.avif) /
[after](evidence/after/ig-warn-light-desktop.avif); editor conflict
[before](evidence/before/merge-conflict-light-desktop.avif) /
[after](evidence/after/merge-conflict-light-desktop.avif); pending change
[before](evidence/before/merge-pending-light-desktop.avif) /
[after](evidence/after/merge-pending-light-desktop.avif); worker view
[before](evidence/before/worker-frame-light-desktop.avif) /
[after](evidence/after/worker-frame-light-desktop.avif).

Not captured because no story renders them: `.sk-notice`, stderr lines,
`.ah-replace-note`, home cards, worker prompt, receipt, error summary and the
transient settings landing highlight. Their change is the same substitution as
the captured ones; the browser specs below exercise those views.

## Checks

- `./scripts/test-focused.sh --area web`: 135 files, 869 tests passed.
- `OH_PORT_BASE=6300 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec …`:
  tool-header-layout (1), file-tool-cards (2), browser-conversation (72),
  worker-view (1), spinoffs (5), browser-editor (21), process-tray (6),
  control-states (2), settings-three-pages (10) passed.
- Same with `--lab`: lab-conversation (14), lab-onboarding (4),
  lab-workspace-page (8), lab-turn-stages (3) passed.
- Review: focused self-review (CSS-only, no daemon, contract or authority path).

## Decisions for later review

- **Grey stripes too.** The brief named coloured stripes; `.ah-process-stderr`,
  `.si-effect` and `.ob-access` used grey ones as emphasis. Removed them as the
  same mannerism (alternative: keep grey as "neutral"). Blockquotes keep their
  grey rule because it is markdown typography, not emphasis.
- **Worker frame edge.** The accent edge was part of the agreed prototype
  (Jari 26.10.) together with the band. Removed the edge, kept the band
  (alternative: replace it with a full accent frame border, which would look
  like a selected panel).
- **Pending merge lines.** The dashed stripe was their only marker besides the
  "odottaa" pill. Replaced with a hatched soft band so pending still differs
  from the landed change's flat tint (alternatives: dashed outline per line,
  which stacks into boxes; pill only).
- **Notices get a full tone border.** Where emphasis seemed wanted (warnings,
  errors, onboarding effect, new-reply card) a 1px `--ah-*-line` border
  replaces the stripe, per the brief; in light theme `--ah-err-line` is faint,
  and the icon carries the state.
