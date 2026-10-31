# Result: English for the composer

## What landed

Every user-visible string of the composer and the modules this unit owns
reads from a catalog of its own in `web/src/text/`:

| Module | Catalog |
| --- | --- |
| `components/composer/Composer.tsx` | `text/composer.tsx` |
| `components/composer/Dictation.tsx` | `text/dictation.tsx` |
| `components/composer/dictationShortcut.ts` | `text/dictationShortcut.ts` |
| `components/composer/Palette.tsx` | `text/palette.tsx` |
| `components/composer/ChoiceList.tsx` | `text/choiceList.ts` |
| `components/composer/CommandRun.tsx` | `text/commandRun.ts` |
| `components/composer/GoalChip.tsx` | `text/goalChip.ts` |
| `components/composer/AttachmentMenu.tsx` | `text/attachmentMenu.ts` |
| `app/attachments.ts` | `text/attachments.ts` |
| `app/newConversationAsk.ts` | `text/newConversationAsk.ts` |
| `components/AIOfferList.tsx` | `text/aiOfferList.ts` |

`completion.ts` has no visible text. Two small structural changes came with
the move:

- A dictation notice now keeps only its kind, failure and elapsed time; its
  title and text are read when it renders, so a notice already showing follows
  a language change.
- `aiOptionCatalog`'s names and descriptions are getters, so the options keep
  one identity (the suggestion is compared by identity) and read the current
  language.

Browser spec `web/tests/composer-english.spec.ts` (`@composer-english`): an
English browser on System sees the field, the row, the command list, the
picker and a `!` command in English. The Finnish specs that exercise these
views pass unchanged (`command-cards`, `attachments`, `dictation-bar`,
`ended-worker-ask`, `composer-geometry`, `browser-conversation`).

English screenshots at device scale factor 2 are in `evidence/`, made with
`web/lab/composer-english-shots.mjs` (synthetic lab; PNGs only, as in
`ui-language-choice`, because the HTML twins carry 5.7 MB of inlined assets):
the idle composer, the `/` and `@` lists, the picker on both tabs, a `!`
command and its card, the attachment menu, a dictation notice and the
onboarding AI options. The working-state Steer/Follow-up chip, Pi's queue and
the goal chip are not reachable in the lab without a running turn or a goal
draft; they render in English in Storybook with the language toolbar.

The composer and AI-offer stories now take their list labels and stand-in
buttons from the catalogs. A built Storybook loaded every one of them with
`globals=language:en` and found no Finnish UI text; the only Finnish left is
the synthetic messages a person wrote into Pi's queue in two stories.

## Finnish that reaches these views from elsewhere

None arrives from the daemon or gateway: the composer's errors are its own.
These callers in other units pass Finnish into the composer's components:

- `app/BrowserConversation.tsx`: `idlePlaceholder` "Kirjoita, niin agentti
  herää…" for a resting agent.
- `app/HistoryView.tsx`: `CommandRun` label "Sinä · paikallinen komento".
- `app/workerRequests.ts` `requestText`: the request
  `newConversationAsk` sends to a new conversation is written in Finnish (it
  is agent-facing message text, not UI).
- Command descriptions in the `/` list come from Pi's skills and prompts as
  their authors wrote them.

## Decisions for later review

- **Steer and follow-up are "Steer" and "Follow-up"**, Pi's own terms, with
  "Later" as the phone's short chip label. Alternatives: "After work" (literal
  but stilted), "Queue". Pi's documentation and TUI use these words, so a
  person moving between the terminal and the browser sees the same ones.
- **Pi's command sources are Skill, Template and Extension; scopes are
  personal, project, Agent and session.** "Template" for Pi's prompt
  templates, since "Prompt" alone reads as the message itself.
- **"Goal" for tavoite** in the goal chip, matching the start page's concept.
- **Hint fragments after a key** (`Tab` adds the top one, `Esc` close) stay
  as separate short messages: each is a key and its action, and the order is
  the same in both languages.
- **"add the path" for zero or one marked file** in the picker's hint, like
  the Finnish "lisää polku", rather than an English plural of zero.
- **An upload error already shown keeps its language** until the next
  attempt, as it is the message of a finished action.
