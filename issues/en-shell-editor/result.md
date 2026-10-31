# Result: English for the context page, the editor and the remaining shell

## What landed

- Catalogs in `web/src/text/` for the context page (`contextPage.ts`), the
  browser editor and everything around it (`browserEditor`, `browserDocument`,
  `workspaceEditor`, `editorSplit`, `editorHeader`, `editorFileTree`,
  `editorConflict`, `editorFilePreview`, `editorReplaceNote`,
  `codeMirrorEditor` incl. CodeMirror's fold phrases), the terminals' frame
  (`browserShell.tsx`), and the remaining modules no sibling unit owned:
  attachments and document previews, agent and archive notices, guides and
  skill instructions, Markdown links and diagrams, the next-waiting round,
  onboarding steps, dialogs, pending notes, wait reminders, settings rows of
  the session, and short words app modules hand to views (`appMessages.ts`:
  shell failure, clone state, storage full, zip name, the "Tell the agent"
  message). Strings left in the earlier catalogs' modules (App frame's
  mutation refusals and archive, status bell, Git identity, Trash, onboarding
  administration, recap, GitLab, models, server integrations) went into those
  catalogs.
- Numbers, percentages, prices and times on the context page, the replace
  note and agent notices go through `formatNumber`/`formatDate`; byte sizes
  of attachments are B/KB/MB in English.
- The two comparisons of displayed text in this unit accept both languages:
  the archive notice's close-refusal check (`closeRefusal` in `App.tsx`) and
  the phone navigation focus target (reads the current navigation catalog).
- `ContextPage.fixtures.ts` is now English synthetic data.
- Browser spec `web/tests/en-shell-editor.spec.ts` (`@en-shell-editor`): an
  `en-GB` browser sees the editor, its file picker and the context page in
  English, with no Finnish letters outside file and conversation content.
- English evidence at device scale factor 2 in `evidence/` (conversation,
  editor, modified editor, full-window editor, context page, terminal), made
  with `web/lab/en-shell-editor-shots.mjs`. The conversation, composer and
  terminal panel in the shots are sibling units' views and still Finnish on
  this branch; the fake Pi's replies are Finnish fixture content.

## Messages from the daemon or gateway

None met in these modules as Finnish text: the editor's open and save
outcomes, terminal refusals and GitHub/storage failures arrive as codes and
are worded in the browser. Agent notices and fake-Pi replies are agent
content, not interface text.

## Decisions for later review

- **`documentFixtures.ts` stays Finnish.** Its strings are the contents of
  synthetic Word, spreadsheet and slide files; the `ä`/`ö` and the split
  `Läm`+`pötila` run exercise non-ASCII and rich-text joining, and tests
  assert them. Alternative: English documents with other non-ASCII; not
  worth it, since a document's language is the person's.
- **Demo-only text stays inline** (`App.tsx` demo banner and the demo's
  workspace-creation reason), switched on the language in place, as
  `LoginCard` already did, so the production bundle carries no demo markers.
- **The worktree branch fallback `agentti` stays** (`app/conversations.ts`):
  it is a branch name, an identifier.
- **A shared catalog where modules are one surface:** `guide.ts` serves the
  guide panel, the guide toggle and `GoalGuide`; `overlays.ts` the shared
  dialogs, pending note and name editor; `markdownRenderer.ts` also the
  Mermaid diagram; `conversationFrame.ts` the stream label and the new
  conversation's model picker; `appMessages.ts` the app modules' short words.
  All are owned by this unit alone, so no parallel translator collides.
- **Wording:** "pääte" is *terminal*, "opas" *guide*, "tavoite" *goal*,
  "taito" *skill*, "tiivistys" *compaction*, "tuo" (disk changes) *bring
  in*, "Peru tuonti" *Undo*.
- **The CodeMirror document's phrases follow the language when a document
  opens**, not live: an open editor keeps its fold tooltips until reopened.
