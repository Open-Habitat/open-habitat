# Result

The closing note of the Workerit panel and its `.ah-bg-life` style are gone
from `BackgroundStrip`. No test, story or snapshot asserted the text.
`./scripts/test-focused.sh --area web` passed.

## Decisions for later review

- `design-system/prototypes/lib/strip.js` still renders the note. It is the
  designer's prototype, not production code, so it was left unchanged.
- The ”Siivoa päättyneet” button title still says ended workers stay because
  they are Taskfleet runs; that explains the button's effect and was kept.
