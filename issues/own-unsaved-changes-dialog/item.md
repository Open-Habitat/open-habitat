---
created: 2026-11-07
updated: 2026-11-07
type: improvement
reporter: jari
status: done
priority: normal
lane: own-dialog-proto
lane_seq: 2
blocked_by: ['@proto-own-confirm-dialog']
collision: [web/src/app/BrowserDocument.tsx, web/src/app/WorkspaceEditor.tsx]
preparation: ready
closed: 2026-11-07
---

# Leaving the editor saves with Kumoa instead of the browser's confirm

## Description

Implementation of Jari's decision on `proto-own-confirm-dialog` (round 1,
direction C *Ei kysy*, 7.11.2026). The prototype is the specification:
`design-system/prototypes/rounds/2026-11-07-oma-vahvistus/` and its
screenshots in `issues/proto-own-confirm-dialog/evidence/` (`r1-c-*` for the
default path, `r1-a-*` for the window used when saving fails, `r1-b-*-4-vscode*`
for the VS Code row). `issues/proto-own-confirm-dialog/result.md` lists the
host facts each direction assumes.

Today `web/src/app/BrowserDocument.tsx` `leave()` asks
`window.confirm(discardQuestion)` (Finnish question, browser-language
*Cancel / OK*, *OK* discards), and `web/src/app/WorkspaceEditor.tsx` asks
`window.confirm(switchToPhoneEditor)` whenever the window narrows below
800 px with VS Code open.

Decided behaviour:

1. **Leaving saves.** Closing the editor, opening another file from the tree,
   switching workspace in the editor and route changes caught by
   `useBlocker` save unsaved text through the existing `save()` without
   asking, and a notice says it was saved, with *Kumoa*.
2. **Kumoa is a real undo.** It writes back the version that was on disk
   before that save, with the same revision check as saving, so the change
   is discarded entirely (it is not left in the editor unsaved). If the file
   changed on disk after the save, Kumoa refuses and says so.
3. **Only a failed save asks**, with direction A's window: it says why the
   save failed and its buttons name their action in both languages, as in
   the prototype's failed-save state (`r1-a-ikkuna-5-ei-tallennu-*`,
   `r1-c-ei-kysy-5-ei-tallennu-*`).
4. **VS Code to phone editor** (below 800 px): Habitat does not save on VS
   Code's behalf. Instead of the browser dialog, Habitat's own row asks the
   person to save in VS Code first; VS Code stays open until they press the
   switch.
5. Switching conversation within the same workspace keeps the editor and
   asks nothing.
6. The browser's own `beforeunload` warning (closing the tab, reload, typed
   address) stays; it cannot be replaced.

This is a fix to existing behaviour Jari asked for, not an experimental
feature: no Settings › Kokeelliset ominaisuudet gate.

## Acceptance Criteria

- [x] No `window.confirm` remains on the editor's leave paths or the VS Code
      switch.
- [x] Leaving with unsaved text saves and shows a notice with *Kumoa*;
      *Kumoa* restores the previous disk version and refuses on a later
      change.
- [x] A failed save on leave shows Habitat's own window; VS Code switch
      shows Habitat's own row.
- [x] Same-workspace conversation switch asks nothing and keeps the text.
- [x] Touched and added browser specs green; live checks in `KOKEILTAVAA.md`.
