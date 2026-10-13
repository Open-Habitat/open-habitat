# Bash card copy, folding and code glyphs

Implemented in the production components. A bash card in a newly read history window starts closed; a live provisional bash call starts open. The conversation store retains the person's tool-row choices by native call ID while that conversation window is retained, including a live call replaced by its saved result. A reload, identity change or window eviction resets them; there is no separate persistent history of disclosure choices.

The output rail now begins with an accessible copy control even for short output. It writes the original full output string, not the three-head/seven-tail preview, and briefly changes to a check mark and copied label. All `pre`, `code`, and `.ah-mono` surfaces disable font ligatures even where a later font shorthand would reset the property.

## Synthetic visual evidence

`lab-{1440,390}-{light,dark}-{short,long,loaded,live,code}.{png,html}`: 20 adjacent screenshot/standalone-static-HTML pairs under this issue. Captured with `PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" node web/lab/capture-bash-copy-fold.mjs` against `scripts/lab.sh start`, the synthetic TLS host, not a live home or profile. `short` has a five-line output with the copy button as the only rail control; `long` has 53 lines with the head/tail preview and full rail; `loaded` is the same completed conversation after a page reload with its bash row closed; `live` is an open running card held by the lab fixture; `code` shows inline `>=`, `==`, `::`, `|-` (the HTML includes code elements and the effective no-ligature rule). The two-line case is additionally exercised by the component test.

Compared with `design-system/drafts/Agentin vuoro.proto.html` in the corresponding states, the copy control is first in the rail, the short rail has no empty jump controls, the closed and live states agree, and the code rule has the same precedence. Remaining differences:

- The draft rail icons are 26px and the production controls are 28px; the existing production icon-button hit area is kept consistent with the other tool controls. Both use a 2px vertical gap and 4px below copy on long output.
- The draft's fabricated commands, outputs, time labels and model identity differ from the synthetic native-history/fake-Pi fixture; the `short` lab directory has five lines rather than the draft's one/two-line example. Neither difference changes the rail behavior.
- The live fixture pauses before the result is available, so its open card has a command but no output rail yet; the draft's illustrated running output already has lines. The completed long capture shows the output rail.
- The draft copy button resets after 1200ms; production uses the same duration but announces “Tuloste kopioitu” rather than the draft's generic “Kopioitu”, to name what was copied.

## Checks

`./scripts/test-focused.sh --area web` passed after implementation (unit/component, formatting, lint and type checks). `./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts`, `lab-conversation.spec.ts`, `design-system.spec.ts`, and `shell-accessibility.spec.ts` cover the native-backed synthetic conversation, lab, controls and existing axe checks. The changed bash control also has a scoped axe assertion in the conversation spec; the final targeted run passed. The full clean gate was not run, per `TESTING.md`. These tests do not establish distinct-UID or live-host behavior.

Review level: focused self-review, not external diff review. The new state only records an ephemeral disclosure choice in the already identity-scoped, bounded conversation store; it changes no native identity, transport or history contract. Tested loaded/live initialization and a remount retaining a toggle, plus full-output clipboard content independently of the preview.
