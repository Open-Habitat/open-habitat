# Folder access inside the interface: prototype round

Review: https://glasspad.example.test/p/fqdma32sotdt66rxd6iaryb7om/

## Choice for Jari

Axis: **where folder access belongs**, not a new browser-permission mechanism.
All three directions use the same synthetic conversation, folder, permission
states and wording. The issue remains open for Jari's choice; production
implementation is later work.

1. **Liitteet — recommended.** The existing composer attachment action opens a
   small menu with individual files and the own-computer folder. Folder help and
   permission controls appear in an anchored panel above the composer, only on
   request. Good proximity to the file task; the extra menu step is its cost.
2. **Asetukset.** Folder access belongs to “Asetukset / Tämä selain”, shown as a
   right-hand panel on desktop and a full content panel on phone. Desktop entry
   is in the account area; a labelled phone shortcut stands in for the account
   navigation, not a proposed new settings authority. Least distraction in the
   conversation, but the person must leave the immediate attachment task.
3. **Kentän kortti.** A folder control beside Liitä opens a dismissible inline
   card above the field. Most visible without a global banner, but occupies
   writing space. The card's body scrolls while its close control stays visible.

Kokeile: avaa **Liitä → Oman koneen kansio** (Asetukset-suunnassa sivupalkin
Asetukset, puhelimessa otsakkeen Asetukset; kolmannessa kentän kansiopainike).
Vaihda **Simuloitu tila**. Avaa “Käytätkö Bravea?”, sulje ohje ja jatka
kirjoittamista. Kokeile myös Valittavissa → Valitse kansio → Salli / Peruuta /
Älä salli. Jaetussa kansiossa kokeile vaihtoa ja jakamisen lopettamista.
Tuntuuko Liitteet luontevalta paikalta myös aiemmin jaetun kansion hallintaan?

## Grounding and honest state

Read the original issue, local-files-access result, production
`web/src/app/App.tsx`, `localFiles.ts`, composer `Composer.tsx`,
`AttachmentChips.tsx`, `BrowserConversation.tsx` / `ConversationFrame.tsx`,
design guidance and recent rounds. The full production conversation header is
represented: title, workspace, state, git/model chips and editor, terminal,
retitle, archive and info icons. There is no invented extra view toolbar.
Unrelated actions are disabled context; paths, counts, messages and user are
invented. The navigation rail is 296px and the reading/composer column uses
production geometry tokens. Phone header wrapping and the settings shortcut
are presentation proposals, not claims of existing runtime behavior.

The parallel fix landed on main as `dfe15e85` during this round. Read its result
and aligned the prototype: Downloads/home themselves can be blocked; ordinary
Downloads subfolders are an option, not a universal bypass. Recommend a dedicated
`Downloads/agentille` or a single attachment for a screenshot. Cancellation,
refusal and denied permission share neutral guidance: AbortError does not prove
which happened. A failed replacement retains the previously shared folder;
retry clears the old feedback. No raw exception or invented success receipt.
SecurityError handling remains the production fix's concern, not a new design
axis here.

States: API absent with optional Brave disclosure; unsupported browser;
selection available; stored permission needs confirmation; ambiguous
cancel/refusal; granted folder. Unavailability never occupies a permanent
product banner. All panels have × and Escape, and focus returns to the visible
opener. The Brave instruction is conditional (“Käytätkö Bravea?”), not a claim
that missing API support identifies the browser. Enabling its flag and restarting
is optional and still requires selecting/granting a folder afterwards. The
address is selectable plain text because browser-internal URLs are not normal
web links. Single-file attachment is always offered as the alternative.

The permission sheet is explicitly labelled **prototype simulation**, never a
fake native-browser prompt. It cannot request access, read, upload or execute
anything. The model attachment is only an invented filename chip. The folder
scope explains that only requested files become server attachments, while the
folder remains available only with this tab open. No new host data, event,
identity claim, store, capability or authority is assumed. Capability, native
handle and permission state already belong to the browser; this round only
moves their presentation.

## Build, publication and evidence

```sh
node design-system/prototypes/build.mjs design-system/prototypes/rounds/2026-10-21-oman-koneen-kansio
node design-system/prototypes/rounds/2026-10-21-oman-koneen-kansio/publish-build.mjs
glasspad publish design-system/prototypes/dist/local-folder-space \
  --space-key open-habitat-proto-local-files-notice --no-open --json
# On a browser-capable host (Playwright and Chromium available):
node check.mjs 2026-10-21-oman-koneen-kansio.html evidence
node check-hosted.mjs https://glasspad.example.test/p/fqdma32sotdt66rxd6iaryb7om/
```

The two check scripts live in the round directory. Browser checks ran on
Cedar in disposable `/var/tmp/oh-proto-folder-01m5eswem`, using the already
available Playwright/Chromium test dependencies, never a personal profile.
Alder did not run specialist browser tests or a product lab. These are authored
HTML checks, **not** host-backed, native-picker, Brave/macOS or production
integration evidence; no full product gate or deployment is claimed.

Final browser result: **234 state/geometry checkpoints passed** across three
directions × 1440/1366/390px × light/dark. Every scenario, permission outcome,
retained grant, draft retention, close/reopen, Escape return focus, modal Tab
loop, attachment fallback/removal and horizontal control bounds were exercised.
Zero console/page errors. Hosted smoke also passes all three directions through
select/grant/close under Glasspad's actual CSP, zero console/page errors.

Six AVIF screenshots and adjacent script-free offline HTML snapshots are under
`evidence/` (each direction desktop/light/Brave and phone/dark/shared). Screenshots
were captured as PNG by the check then encoded with `avifenc -j 2 -s 10 -q 75`.
Offline HTML retains fonts and captured draft text. Self-review inspected the
three layouts, desktop/phone screenshots, complete top row, closing and
permission semantics. It corrected hidden-opener focus on phone, cancellation
ambiguity/retained grants, and moved the comparison picker below the product
so it does not cover phone controls.

Only the generated synthetic `index.html` was published: no issue text,
screenshots, real files, identities, credentials or external requests. Hosted
fonts use token fallback stacks because Glasspad's CSP/null-origin iframe blocks
the bundled font approach; offline evidence retains the bundled fonts. This is
a hosting limitation, not a product typography change.

Published HTML SHA-256:
`89177a300c9731834a7090402d85427d486d58001eacad57cdbc4deb1f5ca989`.

Project-view validation, issue doctor, JS syntax checks, prototype build and
`git diff --check` passed. Doctor's pre-existing unrelated attachment advisories
are not new defects. No new issue was filed and no service/install/product code
was changed.

## Failure / incomplete-work inventory

- First browser matrix timed out by selecting the first settings opener, which
  is hidden on phone. Used the visible locator, fixed the prototype's matching
  focus-return bug and reran successfully. Final header-aligned matrix passes.
  Logs: `/var/tmp/proto-folder-browser.log`,
  `/var/tmp/proto-folder-browser-corrected.log`,
  `/var/tmp/proto-folder-browser-final.log`,
  `/var/tmp/proto-folder-browser-header.log` on Alder.
- First hosted publication succeeded but its optional local `xdg-open` failed
  because Alder has no browser. The stable URL is in KOKEILTAVAA; final publish
  used `--no-open`, and remote hosted smoke verifies it. Logs:
  `/var/tmp/proto-folder-publish.json`,
  `/var/tmp/proto-folder-publish-final.json`,
  `/var/tmp/proto-folder-hosted-final.log`.
- Discovery guessed several old component/HTML/config paths that do not exist
  (`web/src/App.tsx`, Composer/PromptField/top-level header guesses, round
  `index.html`, repo `.glasspad.yaml`). Located the actual app/composer and
  round builder, and read effective home Glasspad config. A pre-landing lookup
  of the parallel worker's result was absent; read it once it landed. No
  required input remains missing. Discovery transcript:
  `/tmp/pi-bash-096a6f4349c6cbff.log` and the task conversation.
- First merge stopped on a KOKEILTAVAA.md rebase conflict with the parallel
  editor round. Preserved its new link and the existing test entries, added this
  round above it, and continued the rebase. No prototype bytes changed. Log:
  `/tmp/pi-processes-bmfoB1/proc_93f1-stderr.log`.
- No required review, build, browser or publication step remains incomplete.
