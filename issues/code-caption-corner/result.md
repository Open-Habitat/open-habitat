# Code caption in the corner — result

The language and (for long output) line count now sit inside the output surface at the top right for reply code, bash output, read/write and edit diffs. There is no footer caption row. The label fades on hover or focus; a top inset keeps the first line clear even without hover, including in the narrow layout. The label sits left of the side rail and scrolling edge. The highlight status in the separate `CodeBlock` caption is unchanged.

## Visual comparison

Synthetic lab captures of reply code: [light desktop](lab-1440-light-reply-code.png) ([HTML](lab-1440-light-reply-code.html)), [dark desktop](lab-1440-dark-reply-code.png) ([HTML](lab-1440-dark-reply-code.html)), [light phone](lab-390-light-reply-code.png) ([HTML](lab-390-light-reply-code.html)). Compared against `design-system/drafts/Agentin vuoro.proto.html` and the `.out-meta.in-corner` rules: same muted inside-corner caption, inset from the rail, and hover/focus fade in both themes. Deliberate difference: production reserves space *inside* the code surface above its first line rather than laying the caption over the text as the prototype can; this is needed to satisfy the non-occlusion criterion at rest and on touchscreens. On phone width the code scrolls horizontally below the caption. File read/write/edit corner placement and fade were also checked by browser geometry assertions.

## Checks

- `./scripts/test-web-fast.sh`: passed after a transient Markdown lazy-import timeout on the first complete attempt; retry passed.
- `OH_PORT_BASE=16500 PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright ./scripts/test-focused.sh --area browser --spec file-tool-cards.spec.ts`: passed (2 cases); browser geometry exercises read/write/edit, fade and rail clearance.
- `OH_PORT_BASE=16600 PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright ./scripts/test-focused.sh --area browser --spec syntax-wrap.spec.ts`: passed.
- Full committed-tree clean gate: `./scripts/ci-local.sh --clean --json` is required for this delivery; its receipt is the authoritative outcome.

The screenshots and browser tests use invented lab identities and content, not a live host. They do not establish separate-UID behavior.
