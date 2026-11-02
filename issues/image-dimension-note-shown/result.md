# Result

The person's image message no longer displays Pi's trailing coordinate hint. The rule lives in `messageText`, used by user-message rendering; `HistoryView` also supplies native image-block presence. Both live entries and reloaded history use this renderer. Native session bytes, the daemon projection, model input and copy-source bytes are unchanged.

## Source evidence

The installed fixture Pi's `dist/utils/image-resize.js` `formatDimensionNote` emits the reported format with a two-decimal scale. `dist/core/agent-session.js` `_prepareRun` appends `\n\n` and newline-joined hints to `trigger.prompt`, then makes one text block followed by image blocks. Its `message_end` handler persists `event.message` using `sessionManager.appendMessage`. There is no separate marked metadata part to hide.

## Decisions for later review

- Keep this a web presentation rule rather than changing daemon history projection. This is the existing attachment-text presentation seam, shared by live and historical messages; native and model-facing data stay intact.
- Match only the exact trailing Pi form (including several newline-separated notes), and only with an image reference or native image block. Do not hide conversion/omission hints or similar prose. A person deliberately typing the exact suffix alongside an image is indistinguishable from Pi's addition; without an image it stays visible. Prefer this narrow ambiguity over broader text removal.

## Validation and review

Tested the worker diff based on `fa68aad2`:

- `npm ci --prefix web` and `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`: passed.
- `./scripts/test-focused.sh --area web`: passed, 168 files / 1255 tests, including exact reported dimensions, multiple images, image-only prompts, no-image/document-only look-alikes, non-trailing and differently formatted text, native image-block context, assistant preservation, and attachment-chip rendering.
- `OH_PORT_BASE=11350 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec attachments.spec.ts` under umask 077: 2 passed. Host-backed synthetic attachment send/reload and focus evidence; fake Pi does not generate resize notes, so the exact-note regression is covered at the component/unit layer, not claimed as native Pi browser evidence.
- `git diff --check`, `issuectl doctor --json`, `python3 scripts/validate-project-view.py`: passed.
- Focused self-review: traced live/history entry rendering, checked user-only application, native-image and attachment-reference cases, strict suffix matching and unchanged persistence/input. No daemon, contract, authority or session-state change.

The supplied `/var/tmp/oh-r54/dimension-note.png` was absent on Birch (ENOENT); no screenshot was copied or committed. Continued safely from the exact issue text and pinned Pi source. Exploratory searches also named absent `web/src/lib` and `internal/daemon/pi_history*`; corrected by inspecting the actual rendering and SDK files. No required checks failed. No full gate or whole browser suite run. Live iPhone verification remains in KOKEILTAVAA.
