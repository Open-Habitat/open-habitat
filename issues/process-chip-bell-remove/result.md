# Result

The Processes chip no longer draws the accent-circled bell in its corner when
the agent's ended turn waits on a process. Its CSS (`.ah-bg-corner.wait` and
the rule that moved the attention dot beside it) and two biome suppressions
that only existed because of it are gone. The fact behind it is renamed
`facts.proc.bell` → `facts.proc.waited`; it still drives the chip's
`aria-label`/`title` sentence "agentti odottaa: <names>".

## Verification

`npm ci --prefix web && ./scripts/test-focused.sh --area web` passed (format,
lint, TypeScript, 785 tests in 125 files). No browser spec asserts the bell; no
spec was touched, so none was run. No Storybook story renders the strip.

## Decisions for later review

- The bell on a process *row* inside the opened panel (`.ah-bg-wake`, "Agentti
  odottaa tätä") stays: the issue and Jari's decision name the chip's corner
  mark. If that bell should also give way to the ◉ ring, it is a separate
  change.
- The chip's accessible sentence keeps "agentti odottaa: …", so the waiting fact
  stays available to screen readers and in the hover title.
- `design-system/prototypes/lib/strip.js` still draws the bell; prototypes are
  design material, left untouched.
