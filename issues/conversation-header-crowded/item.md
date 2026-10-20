---
created: 2026-10-20
updated: 2026-10-20
type: improvement
reporter: jari
status: open
priority: normal
lane: header
lane_seq: 2
collision: [conversation-header]
---

# Conversation header is overcrowded: move Editori to the tools, shorter model pill, longer title

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20 (screenshot: title 'Mistä projektista tarkoitat? Lähetä p…', workspace, Odottaa sinua, Editori button, git pill, 'claude-opus-5-5 · medium', terminal/heading/archive/info icons): too full. 1) Move Editori among the tool icons with its own icon (not the terminal glyph). 2) Model pill: just 'Opus 5.5' and 'Medium' with a small thinking/level icon, human model names. 3) Opening the pill shows information, not a choice form: the model and its alternatives as a ribbon/segmented row, and the thinking level as a ribbon — it clarifies the state rather than offering a lot of choices. 4) The title gets the space freed up; currently only a couple of words show before the ellipsis. Desktop and phone, light and dark; lab before/after captures.

## Implementation result — blocked validation

Implemented compact editor tools with a distinct editor glyph, a shorter human-readable model/thinking pill, and a read-only model/level ribbon instead of the header's new-conversation form. Desktop titles consume remaining space; phone titles have their own row. Title regeneration is unchanged. New browser assertions cover light/dark, desktop/phone title space, information-only semantics, and Escape focus. The former header-choice assertion now checks native state without a mutation; composer selection and recovery remain covered by their existing journeys.

Evidence against base `b779dafa85444c17bd293056167ed4e117d47955` plus this worker's changes:

- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area web`: passed, runner job `c242542eec369558b18ae024d618bce73af4feee9289577e3f9ece907b488420`, snapshot `2eb27edb6b8faa9b06707dd114e52ded6aad6b5773848b258206e9d135bec274`. Includes formatting, lint, type checks, unit/component tests and model-name regression cases. This predates the final composer-summary clipping fix.
- The initial browser invocation incorrectly repeated `--spec`; the adapter selected only `workspace-editor.spec.ts`. Job `acec373e63dcbb42f2bf1fdd3f47ecff22b4f7bebf903e2223dfaf8c08201b64`, snapshot `c044b5e66454d518605eb35f6952fb76de55745cc36996937e0be7fd5a356f08`: 4 passed, phone case failed because the composer's model summary painted over Send and intercepted clicks. Trace inspected from fetched synthetic artifacts. Added clipping to the summary only, leaving the disclosure menu unclipped; this final fix is NOT verified.
- Subsequent web admission failed with `spool_quota` (retained inputs near the runner's 8 GiB cap). Attempted to archive only this run's two terminal input directories, preserving all bytes under `/var/tmp`; admission then failed because compaction expects the original input paths. Restored both directories immediately. No other jobs' input was moved, no database was edited, and no installation code was changed. Final observed retained bytes: 8,472,943,999, leaving 116,990,593 bytes, less than a source capture.
- Required final web and browser checks remain blocked. Run each spec separately after runner admission is repaired: `title-regeneration.spec.ts`, `browser-conversation.spec.ts`, and `workspace-editor.spec.ts`.
- Before/after synthetic lab captures deferred: Alder policy forbids lab execution. No live-host captures or deployment performed.
- Focused self-review selected: browser presentation only, no Unix-user/authority/install boundary changes. Reviewed model fallback/provider matching, read-only semantics, keyboard closure, responsive title layout, editor naming, and unchanged retitle action. No independent security review was required.

Issue remains open and worker must not merge until final focused checks pass.
