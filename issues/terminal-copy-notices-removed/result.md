# Result

Terminal selection copying and sending to the conversation no longer show success notices. The terminal's copy-on-select button also stays “Copy” rather than becoming “Copied”. Clipboard copying, shortcuts, selection handling and composer insertion/focus remain intact. Refused explicit copies still show an error; an unavailable clipboard API now takes that same error path instead of silently doing nothing. No replacement toast or new switch was added.

Removed unused Finnish/English strings, the copied-state story and state plumbing, and the obsolete Explain R10 sentence. Regenerated the shipped UI skill references from their sources. Other terminal lifecycle notices remain unchanged.

## Verification

- Focused self-review: traced explicit copy, experimental copy-on-select, tmux selection, composer insertion, error rendering and generated references. Removed a dangling prop comment found during review. No daemon behavior, contracts or authority boundaries changed.
- `./scripts/test-focused.sh --area web`: 219 files, 1,713 tests passed, plus static/catalog checks.
- `OH_PORT_BASE=19500 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec browser-shell.spec.ts --spec browser-terminal.spec.ts`: all 15 host-backed synthetic browser tests passed.
- Both modified clipboard journeys repeated three times with 60 ms reply jitter: all 6 passed. Assertions cover actual clipboard content, absence of success notices, visible refused/unavailable clipboard errors, composer contents/focus, and copy-on-select without a copied-state marker.
- Generated UI reference check and `git diff --check` passed.
- No live installation or separate manual Explain-mode visual inspection was used. The Explain change only removes the obsolete sentence; mapping and presentation are unchanged.

Live check: select terminal output and copy it, then select it again and send it to the conversation. Neither action should announce success; the latter leaves the text ready in the composer. A refused clipboard operation should still show an error in the terminal panel.

## Decisions for later review

- Removed the terminal's inline “Copied” state as well as the two named toasts. Alternative: keep the inline success state. Reason: it confirms the same terminal copy action, and retaining it would leave the obsolete Explain sentence meaningful rather than satisfy the requested cleanup. Other components' copy indicators are untouched.
- Treat a missing clipboard API as an explicit-copy error. Alternative: preserve the existing silent optional-chain return. Reason: the requested error feedback must remain useful when clipboard support is unavailable, not only when a write rejects. Existing keyboard/automatic-copy behavior was not expanded.

## Other success confirmations — unchanged inventory for Jari

These are review candidates, not a recommendation to delete every confirmation. In particular, seeing the source text does not prove a clipboard write succeeded, and some notices offer recovery or Undo.

### Copy feedback

All paths below are under `web/src/components/` unless stated otherwise.

| Place | Existing confirmation |
| --- | --- |
| `WorkspaceActions.tsx` | “Polku kopioitu” / “Path copied” and a check mark after copying the displayed workspace path. |
| `ViewLink.tsx` | Shared copy control becomes “Kopioitu” / “Copied” with a check mark for displayed links. |
| `GitStatus.tsx` | Git copy control uses the copied label. |
| `AccountKeys.tsx` | Public-key copy button becomes “Copied”; a separate after-copy instruction also appears. |
| `OwnMachines.tsx` | Copy control becomes “Copied”. |
| `Integrations.tsx` | Shared integration copy button becomes “Copied” with a check mark. |
| `WorkspaceTrash.tsx` | Command-copy button title becomes “Copied” with a changed icon. |
| `PiDeviceSignIn.tsx` | “Koodi kopioitu leikepöydälle.” / “Code copied to the clipboard.” after copying the displayed device code. |
| `BashToolCard.tsx` | Command-copy icon becomes a check mark and its accessible label says “Command copied”. |
| `OutputBox.tsx` | Output-copy control uses a check mark and “Output copied”. |

### Results already visible in the UI

- `web/src/components/InlineTextSetting.tsx`: a saved status beside the field containing the new value.
- `web/src/components/OnboardingSettings.tsx` (`SaveStatus`): a check mark and saved status after the settings change remains visible.
- `web/src/app/BrowserShell.tsx`: stopped/detached terminal toasts even though the tab disappears. Detach text additionally explains that the terminal keeps running and how to rejoin, so this is not purely redundant.
- `web/src/app/EditorSaveNotice.tsx`: saved/undone notice after leaving the editor. This carries a real Undo action and should not be treated like a disposable copy toast.

The inventory is source-based and scoped to obvious candidates; it is not a full usability audit.
