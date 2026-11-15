# Result

Terminal selections now use a dedicated design-token pair, derived from each theme's accent and on-accent text. Focused and inactive selections use the same opaque fill. Selected ANSI-coloured text is overridden with the paired foreground. No experimental setting was added.

## Contrast

WCAG relative-luminance ratios against the terminal's `--ah-sunken` background; the before fill was `--ah-accent-soft`. Both focused and unfocused selections have the after values.

| Theme | Before area | After area | After selected text |
| --- | ---: | ---: | ---: |
| Päivä | 1.04:1 | 5.48:1 | 6.16:1 |
| Yö | 1.37:1 | 12.45:1 | 11.47:1 |
| Korkea kontrasti | 1.45:1 | 16.97:1 | 16.97:1 |

The existing `web/src/test/boundaryContrast.test.ts` measures the new token pair: area minimum 3:1 (4.5:1 in Korkea kontrasti), text minimum 4.5:1 (7:1 in Korkea kontrasti). Browser assertions verify that the rendered selection and ANSI-red sample actually use those tokens in each theme and focus state.

## Verification

- `./scripts/test-focused.sh --area web`: 219 files, 1716 tests passed; static checks passed.
- `OH_PORT_BASE=19700 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec browser-terminal.spec.ts`: all four tests passed.
- Synthetic-lab capture run: all three themes, Shift+drag with tmux mouse reporting enabled and ordinary drag with it disabled, focused and unfocused. Before/after sets each contain 12 scale-2 screenshots with paired offline HTML snapshots. Evidence is outside the repository in the worker-results directory for run `01m7g4jsamh1q12v320tm640kn`, under `before/` and `after/`.
- Focused self-review: checked alias resolution, live theme changes, xterm's opaque selection and foreground handling, both focus states, and screenshots. No authority, daemon, contract or session-state behavior changed.
- This is synthetic host-backed evidence using real tmux/bash, not a live installation or separate-UID isolation check. Full suite deferred to integration.

Initial capture attempts exposed missing local SDK dependencies, the snapshot helper's lab-only guard, the lab's different workspace names, and a session-level tmux mouse option overriding the global option. Dependencies and capture setup were corrected; final runs passed.

## Decisions for later review

- Keep inactive selection equally prominent rather than dimming it: losing focus must not make the copied region disappear. The terminal focus outline continues to identify focus.
- Use a terminal-specific semantic pair aliasing accent/on-accent rather than changing `--ah-accent-soft` globally: soft fills elsewhere have different roles, including the editor selection.
- Preserve the explicit selection foreground, but use the paired colour rather than normal ink: arbitrary ANSI text could otherwise match the stronger background.

Live check: open a browser terminal, select output with Shift+drag, switch between Päivä, Yö and Korkea kontrasti, then move focus to the composer. The selected area should remain obvious and its text readable. For plain-drag selection, disable mouse reporting in the current tmux session with `tmux set mouse off`; restore it with `tmux set mouse on` afterward.
