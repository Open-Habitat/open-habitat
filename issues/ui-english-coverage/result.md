# Result: English for the whole browser UI (finisher)

## What landed

- **Finnish-string scan in the gate.** `web/src/i18n/finnishScan.test.ts`
  (logic in `finnishScan.ts`) parses every `.ts`/`.tsx` file in `web/src` with
  Vite's own parser and fails on a string literal, template piece or JSX text
  that carries a Finnish letter or a word only the Finnish catalogs use (the
  vocabulary is derived from `src/text`: words of four or more letters in a
  `const fi` half that no English half uses). Comments are not read. It skips
  `src/text`, `src/test`, the generated contracts, tests, stories and
  `*fixtures.ts`. Settings route slugs (`settingsSections` ids) are
  identifiers; everything else intentional is in the test's allowlist by file
  and exact text with its reason (settings index Finnish half, repo section
  kinds, the Git identity source value, the worktree branch fallback, two
  query parameters, demo-only text). It runs in `npm test`, so in
  `test-web-fast.sh` and the clean gate. A planted
  `<span title="Peruuta">Sulje ikkuna</span>` in `Primitives.tsx` made it fail
  on both strings; the test also pins a string, template and JSX text being
  caught and a comment not.
- **Finnish the scan found in `web/src`**, moved into catalogs: a running
  tool's "· Kutsu" (`conversationEvents`), the editor's pending-line tag
  "odottaa" (`codeMirrorEditor`), a PDF page's "Sivu N"
  (`documentPreview`), a file link's ", rivi(t)" (`markdownRenderer`), a split
  menu's ": loppu" (`overlays`). A dead comparison against
  "Kirjoita viesti." in `Primitives.tsx`, which nothing produced, is gone.
- **Daemon/gateway text on screen:**
  - *Uusi keskustelu*: the browser names a conversation whose
    `title.source` is `new_conversation` from its own catalog
    (`app/agentTitle.ts`); every `title.display` read goes through it.
  - History placeholders (`[Sisältöä ei tueta]`, `Työkalu: X`,
    `Tuntematon viesti`, `Sisältömuotoa ei tueta`, `Tuntematon Pi-tapahtuma`):
    the daemon's flattened `content.text` now holds only the message's own
    text, or nothing for an unknown entry. The browser already draws tool
    calls, other blocks and unknown entries from its catalog; an unknown
    entry's *Copy details* now copies the shown summary.
  - The browser's `unfamiliar()` parser for a `[Sisältöä ei tueta: type]
    {json}` marker was dead code (the daemon stopped emitting it in
    6c9d0bec) and is removed with its two tests and catalog keys.
  - A skill's unresolved `$ARGUMENTS` shows as `[arguments]`, like its
    neighbours `[skill source]` and `[skill directory]`.
  - The view host's plain-text failure pages (expired link, missing file,
    unavailable view…) follow the first `Accept-Language` entry: `fi`/`fi-*`
    Finnish, anything else English, with `Content-Language`.
- **English walk** with `web/lab/ui-english-coverage-shots.mjs` (synthetic
  lab, `en-GB` browser, System language): it lists every Finnish letter in a
  view's text, accessible names, tooltips and placeholders outside
  conversation content. Sign-in, the conversation with its composer, the
  workers panel and settings have none; home, the workspace and a new
  conversation show only fixture content (conversation titles and recaps, the
  fixture repository's Finnish start page and goal cards).
- **Screenshots** at device scale factor 2 in `evidence/`: `sign-in`, `home`,
  `workspace`, `new-conversation`, `conversation` (with composer),
  `workers-panel`, `settings`, `settings-appearance`. PNGs only, as in the
  unit issues. The fake Pi answers in Finnish; that is fixture content.

## Checks

`go test ./internal/gateway ./internal/daemon` pass (new:
`TestViewFailureFollowsFirstBrowserLanguage`,
`TestNativeTextFlattensOnlyTheMessagesText`). Web fast checks pass (161
files, 1183 tests). Browser specs: view-links, browser-conversation (75),
ui-language-conversation, en-shell-editor, composer-english,
lab-workspace-landing pass. Storybook was not rebuilt here: no story changed,
and the units each checked their stories in English.

Review: independent `/llm-review` (gpt-6-astra finder, no verifier) with
`/assess-findings`. Two findings, both confirmed and fixed: the gateway's
`fi` prefix matched Filipino `fil`, and an unknown entry's copy action would
have copied an empty string.

## Decisions for later review

- **The daemon still writes "Uusi keskustelu" into `title.display`.** The
  browser ignores it for `source: new_conversation`. Alternatives: an empty
  display (the contract requires `minLength: 1`) or an English placeholder.
  Both are contract or daemon changes that the existing `source` code already
  makes unnecessary. Any future non-browser reader of the snapshot would see
  the Finnish placeholder.
- **History placeholders became empty text rather than codes.** The browser
  already had the codes it needs (`blocks[].type`, `entry_type`, `kind`).
  Text copied from an assistant answer now holds the answer's text only,
  without "Työkalu: read" lines. A first message that is only an image no
  longer gives the fallback title "[Sisältöä ei tueta]"; the title comes from
  the next message with text.
- **The view host's failure pages use `Accept-Language`, not the person's
  choice.** The view origin has no session that carries the choice, and the
  pages are also read by anyone a link was shared with. This is the same rule
  as the app before sign-in.
- **`[arguments]` is English for both languages**, like the two markers next
  to it. Translating it would mean the browser rewriting skill text it shows
  as native content.
- **The scan derives its Finnish vocabulary from the catalogs.** It misses
  Finnish written only in words shorter than four letters, or in words the
  English catalogs also use. A hand-written word list would drift. Single
  lowercase words such as route slugs are not exempted wholesale (that is
  how "odottaa" was found); slugs come from `settingsSections`.
- **The scan does not read stories, fixtures or `src/test`**: their Finnish is
  synthetic content. Storybook's English rendering is the units' language
  toolbar check.
