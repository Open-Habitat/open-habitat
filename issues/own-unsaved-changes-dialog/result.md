# Result

Leaving the browser editor saves through the document's own save and the
page's top bar says *Tallennettu tiedosto · Kumoa*. Kumoa writes the version
that was on disk before the save back with the saved version as its base, so
the daemon's existing base-version refusal turns down an undo after any later
change; no host or contract change was needed. Only a save that cannot be
done opens Habitat's window (*Muutoksia ei voitu tallentaa* · *Hylkää
muutokset* · *Jatka muokkausta*). Narrowing VS Code below 800 px shows
Habitat's row under the frame (*Pysy VS Codessa* · *Vaihda puhelimen
editoriin*). No `window.confirm` remains; `beforeunload` is unchanged.

Synthetic host-backed evidence: `web/tests/browser-editor.spec.ts` (26 passed,
including the three new cases for Kumoa, the failed-save window and the
same-workspace switch) and `web/tests/workspace-editor.spec.ts` (9 passed, 1
skipped as before). Screenshots with HTML snapshots are in `evidence/`
(`OH_VISUAL_CAPTURE=1` refreshes them).

## Decisions for later review

- **Where the notice is.** The shared notice row in the page's top bar
  (the one archiving and the Trash use), not the prototype's floating toast
  in the editor or under the header. Alternative: the prototype's toast,
  which would have been a new one-off style. Chosen because the brief asked
  for the existing notice mechanism and because the row survives the route
  change that leaving can be.
- **Conversations that keep the editor ask nothing and write nothing.**
  Moving to another conversation in the same workspace, or opening Settings
  over the view, leaves the text unsaved in the editor. Alternative: save on
  every route change. Chosen because the document is not leaving, and the
  issue says such a switch keeps the text.
- **Another workspace's conversation saves after the route has moved.** The
  conversation opens at once and the document, still bound to its own
  workspace, saves; if the save fails the window appears over the new
  conversation, and *Jatka muokkausta* keeps the document with the existing
  "workspace no longer selected" note. Alternative: block the route until
  the save finishes, which needs to know the destination's workspace before
  App resolves it. Chosen because the document already outlives a workspace
  change this way.
- **Opening another file reads it before saving the current one.** A file
  that cannot be opened (unsupported, too large) writes nothing. Alternative:
  save first, then read.
- **What Kumoa restores after a merged save.** The disk version right before
  the write, which includes any agent change the save brought in, not the
  version the editor first opened. That is "the version on disk before that
  save".
- **Kumoa does not refresh an editor that has the same file open again.**
  The document notices the change at its next check (window focus, an agent
  tool call, or the read before its next save). Alternative: a channel from
  the notice to the open document; not built because it is rare.
- **Wording of the failed-save window.** A conflict names the agent only when
  the conflicting change came from the agent's file tool, otherwise "muutettiin
  samasta kohdasta muualla", following the editor's neutral-attribution rule;
  other failures reuse the editor's existing save-problem sentence.
- **VS Code row hint says Ctrl+S** as in the prototype, also on a Mac where
  it is Cmd+S.
- **The prototype round** `design-system/prototypes/rounds/2026-11-07-oma-vahvistus/`
  still calls the removed catalog messages from its "current state" button;
  it is a historical round and was left as it was.
