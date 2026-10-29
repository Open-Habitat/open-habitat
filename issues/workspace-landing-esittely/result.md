# Result: workspace page Esittely, goals land with Aloita done

## What changed

- **Esittely on the workspace page** (`web/src/app/WorkspaceLanding.tsx`,
  `web/src/components/WorkspaceIntro.tsx`): the authored start page from the
  existing file-only read (`readStartPage`), between the page head and the Git
  row: title, the body's first paragraph (rest behind *Näytä koko esittely*),
  *Mitä haluat tehdä?* and the same goal cards as the conversation start page
  (`StartGoals`, extracted from `StartHere`). An absent page shows one dashed
  line with **Luo aloitussivu**; a `needs_update` page the same line with
  **Päivitä aloitussivu**. Both open a new conversation with
  `/open-habitat-start-page ` in the field and the caret after it. Loading
  draws nothing; a read failure is one quiet line with *Yritä uudelleen*.
- **A goal lands with Aloita done** (`prepareGoalConversation` in
  `web/src/app/goalGuide.ts`): the goal's skill is resolved exactly as Aloita
  resolves it, the prepared draft is written to the new conversation's draft,
  the guide is set (it opens beside the conversation on a wide screen; on a
  phone it is behind *Opas*), and only then is the conversation created. Its
  field is focused with the placeholder selected, or the caret at the end
  when there is none.
- **Selection survives creation** (`usePreparedField`): the new conversation
  is drawn twice (while created, then created) and the goal chip appears
  only after its start page is read, each of which used to reset the field.
  The prepared selection is handed over with the guide (`adoptGuide`) and
  re-applied whenever the field shows the prepared text, until the person
  edits it. It maps the draft into the field's displayed form, so a kept
  draft with an attachment does not lose the selection.
- **The conversation start page's cards behave the same** (decision 1):
  choosing a card prepares the draft at once; the in-page guide with its two
  Aloita buttons and `GoalGuide` are gone. `GuideArticle` stays for the chip
  and skill readers.
- The embedded `open-habitat-start-page` skill now tells authors that the
  workspace page shows only the first paragraph, and describes choosing a
  goal instead of Aloita.

## Decisions for later review

1. **The conversation start page's goal cards also skip the guide.**
   Alternatives: keep card → guide → Aloita there. Chose the same behaviour
   because the cards are identical in both places, and Jari's rule (a goal
   must not land somewhere that still needs an Aloita press) applies equally
   to the in-place guide. The guide is still one press away (*Opas* in the
   header, the goal chip), and on a wide screen it opens beside the field.
2. **A goal keeps an unfinished new-conversation draft**, as Aloita keeps the
   visible draft (request, then the earlier draft, then the placeholder).
   Alternative: replace it. Chose keeping because nothing is lost and the
   person sees it at once in the field.
3. **Goals are inert while no conversation can be started** (creation under
   way, read-only, default model unknown), with the same reason the page
   already shows as the card's tooltip. Alternative: hide the goals. Chose
   inert so the page does not jump when the reason clears.
4. **Single-workspace mode shows the Esittely too**, under the page's head;
   the hint names the top bar's *Uusi keskustelu* instead of +.
5. **Esittely only appears for a workspace whose directory is confirmed**
   (the same fact that enables +), so a missing workspace does not show a
   read error line on top of its own problem.
6. **No cache for the workspace page's start page read.** It is one small
   file read by the person's own daemon per page visit;
   `browser-conversation.spec.ts`'s request budget now lists it as an
   independent workspace-page read.
7. **A failed skill check prepares nothing** and says so under the cards;
   choosing the goal again retries. Alternative: fall back to plain text.
   Chose retry because Aloita behaves this way and a silent fallback would
   lose the skill call.

## Verification

- Web: `./scripts/test-focused.sh --area web` (143 files, 919 tests) — new
  `goalStart.test.tsx` (preparation, skill fallback, failure, selection
  across creation and chip, attachments, focus not stolen) and
  `WorkspaceIntro.test.tsx`.
- Browser (`OH_PORT_BASE=7300`, 2 workers): new `lab-workspace-landing.spec.ts`
  (1440 light, 390 dark: Esittely, disclosure, axe, no overflow, no creation
  on view, goal → created conversation with chip, focus and selected
  placeholder, guide beside/behind Opas, absent page → *Luo aloitussivu*);
  updated `start-here.spec.ts`, `lab-start-page-goal.spec.ts`,
  `browser-conversation.spec.ts`; also passing unchanged:
  `single-workspace-mode`, `workspace-slice`, `design-system`,
  `reconnect-recovery`, `lab-desktop-header`, `lab-phone-header`,
  `lab-onboarding`, `lab-conversation`, `lab-title-generation`.
- Go: `./internal/daemon` (embedded skill), `./test/browser-host` (fixture
  gained a second intro paragraph).
- Review: independent `/llm-review` (gpt-6-astra finder): one should-fix
  (selection lost with an attachment in the kept draft), reproduced by a
  failing test and fixed.
