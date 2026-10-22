# Skill invocation — Siru riff, round 2

Review: https://glasspad.example.test/p/i2emlicdsrv22qlnprknit2s2a/

## For Jari

Siru näyttää nyt suljettuna **vain taidon kuvauksen**. Oma lisätekstisi on sen alla erillään. Nuoli on oikea SVG-väkänen, ei fonttimerkki; kuvauksessa ei ole HTML-merkintöjä, teknistä nimeä tai lähdepolkua.

Vertaa **Sivupaneelia, Dialogia ja Omaa näkymää**. **Suosittelen Sivupaneelia:** ohje aukeaa reunaan siirtämättä keskustelun lukukohtaa; puhelimessa paneeli täyttää ruudun. Dialogi nostaa ohjeen keskelle. Oma näkymä antaa eniten lukutilaa, mutta vie keskustelun kokonaan pois näkyvistä, kunnes palaat takaisin. Paneeli ja dialogi sulkevat taustalla toimimisen lukemisen ajaksi.

**Sopiiko Sivupaneeli, vai luetko ohjeen mieluummin Dialogissa tai Omassa näkymässä?** Kokeile sirua, Sulje/Takaisin-painiketta ja Esc-näppäintä, pitkää nimeä sekä puuttuvaa kuvausta. Luonnos ja lukukohta säilyvät. Issue jää avoimeksi ja valmistelu odottaa valintaasi (`pending`); tuotantokoodia ei ole muutettu.

## Round 2 scope and comparison

Jari’s 2026-10-22 decision selects Siru as the common base. This round varies **where the full recorded skill instruction opens**, not the collapsed presentation. The three variants use identical invented content and the same description-only chip:

- **Sivupaneeli (recommended):** a modal right-hand sheet, 540px on desktop and full-screen at 390px. Some conversation context remains visible behind the scrim; it cannot be interacted with until closing.
- **Dialogi:** a centered modal reader, 720px wide on desktop and full-screen on the phone. Stronger separation, but more of the conversation is obscured.
- **Oma näkymä:** the reader replaces the conversation stream and composer within the main column. The titlebar stays. An explicit “Takaisin keskusteluun” and Escape restore the mounted conversation and draft. This is a local view, not a new route, browser tab or promise of browser-Back handling.

The collapsed control contains description text and one right-facing SVG chevron only. It does not expand inline, so there is no misleading down/up caret state. Its accessible name and hover title say “Näytä taidon ohje”. Own user arguments remain outside that control; a skill-only message does not gain a placeholder paragraph. The reader shows the technical name, readable complete instruction, and a separate **Tallennettu lähde** disclosure for the recorded wrapper and example path. Source text is escaped, never inserted as active HTML. Plain messages mentioning `<skill>` remain plain messages.

## Source grounding and decisions for later review

Re-read round 1’s result and source modules, the decision note, design-system/prototype/web instructions, `design-system/design.md`, `Conversation.tsx` (`Message`/`UserMessage`), the production layout context retained from round 1, and the lab launcher/session helper. This is the same **source-grounded presentation-copy method as round 1**, not a production lab capture. The 296px rail, conversation measure, user bubble, titlebar icons and local composer are retained unchanged. No shared prototype library, production component or host contract changed.

**Description availability remains a real implementation constraint.** Round 1 established that native Pi expansion strips frontmatter. This fixture places its short description in the recorded body’s introductory paragraph; that exact paragraph supplies the chip. It does not assume a historical frontmatter description exists, fetch the currently installed skill or generate a description from the name. The “Ei kuvausta” fixture demonstrates the honest fallback “Näytä taidon ohje”. Proposed implementation default for review: use an available recorded introductory description; otherwise use that fallback. A requirement to recover the original frontmatter description for every old invocation would need separate source evidence/design, not a silent current-file lookup. The fixture demonstrates the presentation, not a general-purpose Markdown-summary extractor.

Name, instruction body, example source path and extra user text stay tied to the recorded message. No claim is made about the skill’s current installation, source-file availability or exact original slash-command bytes. English in the example instruction is source content, not untranslated interface text. All workspace, messages, descriptions and `/example/skills/…` paths are synthetic. Only the generated synthetic HTML was uploaded; issue documents, evidence and real user data were not published.

## Rebuild and browser evidence

```sh
node design-system/prototypes/build.mjs design-system/prototypes/rounds/2026-10-22-taidon-kutsu-siru
node design-system/prototypes/rounds/2026-10-22-taidon-kutsu-siru/publish-build.mjs
# Disposable Chromium environment with Playwright:
node check.mjs offline.html evidence
node check.mjs https://glasspad.example.test/p/i2emlicdsrv22qlnprknit2s2a/
```

`check.mjs` belongs to the new round directory. Build output is ignored; the source round is committed. Glasspad space key: `open-habitat-proto-skill-siru-round2` (round 1’s URL and sources are preserved). Hosted `publish-build.mjs` removes embedded font faces because of Glasspad’s sandbox; system-font fallback is disclosed in the prototype. Offline screenshots/HTML retain the bundled production fonts.

- **234 offline + 234 hosted state checks passed:** three variants × 1440/1366/390px × light/dark × 13 states (four recognized-skill fixtures, closed/open/closed, plus one plain-message fixture). Zero page/console errors in both matrices.
- Checks cover exact description-only text, SVG chevron path, no inline instruction dump, separate extra text, only-skill presentation, missing-description fallback, long technical name in the reader, recorded raw-source disclosure, Enter opening, forward Tab within modal content, explicit close/back, Escape, restored focus, retained stream scroll offset and draft, rail/titlebar geometry, phone preview and horizontal containment.
- **12 screenshot/static-HTML pairs** in `evidence-round2/`: every variant at desktop 1440/light and phone 390/dark, collapsed and open. AVIF images accompany script-free self-contained HTML. These are authored synthetic-prototype captures, **not host-backed production lab evidence**. 1366px and the complementary themes are covered by browser assertions, not additional screenshot pairs.
- Self-review inspected sheet desktop/light and phone/dark, dialog desktop/light, own-view phone/dark and the collapsed phone chip. No independent model review, product gate, live-service check, general sanitizer/parser test or native-provider test is claimed.

Browser execution used Cedar’s isolated `/var/tmp/oh-proto-siru-01m5h3rxn276`, reusing the existing disposable Playwright dependency without installing a persistent application or opening a personal profile. Final browser log: `/var/tmp/siru-browser-matrix.log` on Alder. Publish receipt: `/var/tmp/siru-publish.json`. Hosted HTML SHA-256: `b06ed4a584690bcab703ddfe7fbb32c19c8fa6acaabbb7869d295c5a6462a2dd`. JavaScript syntax checks, project-view validation, issue doctor, evidence-pair/script-removal checks and `git diff --check` passed.

## Round 2 failure inventory

The first offline test incorrectly expected Shift+Tab from the first dialog control to remain inside document content. Chromium can move focus to browser chrome at that boundary. Changed the assertion to forward Tab from Close to the source disclosure; the complete offline and hosted matrices then passed. This was an overstrict test assumption, not a product change. Initial log: `/var/tmp/siru-offline-attempt1.log` (`false !== true`, check line 69); final log above.

An optional Taskfleet version probe used unsupported `--version`; recovered with documented `taskfleet version --output json` (0.16.0). No run-management or required delivery step failed as a result. No required browser/publication step remains incomplete.

---

# Round 1 — preserved below (superseded recommendation)

# Skill invocation — prototype round

Review: https://glasspad.example.test/p/b552pubbvo7ely3wdqsay57zhm/

## For Jari

Vertaa **Sirua, Korttia ja Komentoa** samassa keskustelussa. Kaikissa taidon sisäinen polku ja pitkä ohje jäävät oletuksena piiloon, mutta itse kirjoittamasi lisäteksti näkyy kokonaan niiden alla. Taidon **Ohje** avaa natiivihistoriaan tallentuneen tekstin ja lähdepolun. Se ei lue nykyistä taitotiedostoa.

**Suosittelen Korttia:** teknisen nimen lisäksi näkyy taidon oma otsikko. Se auttaa tunnistamaan tarkoituksen ilman uutta, keksittyä kuvausta. Siru säästää yhden rivin; Komento sopii, jos haluat nähdä ensisijaisesti tutun `/skill:`-tunnisteen. Kortin englanninkielinen otsikko tulee tallennetusta esimerkkitaidosta, ei käyttöliittymän käännöksestä.

Kokeile lisätekstiä, pelkkää taitoa, pitkää nimeä ja tavallista viestiä. Avaa ja sulje Ohje myös näppäimistöllä; vaihda teemaa ja puhelinleveyttä. Kirjoitettu luonnos säilyy vertailussa. **Valinta: riittääkö Sirun tunniste vai auttaako Kortin otsikko?** Mitään suuntaa ei ole hyväksytty. Issue jää avoimeksi, `preparation: pending`; tuotantototeutus tehdään valinnan jälkeen.

## Axis and source grounding

The axis is how much identity/context a recognized skill invocation shows while collapsed. The recorded skill body, extra user text and surrounding conversation are identical in all three directions:

- **Siru:** a compact outlined disclosure with the exact skill name and a Taito label.
- **Kortti (recommended):** the name plus the first heading of the recorded body, inside a subdued card. No generated description or skill-registry lookup.
- **Komento:** `/skill:<name>` as the disclosure's first line, without another chip surface. This is a display reconstruction, not proof of the exact original input bytes.

Read the reported screenshot `/var/tmp/oh-shots/skill-use.png` on Alder, the design-system/prototype/web instructions, `design-system/design.md`, the editor-buttons round-2 result and sources, `Navigation.tsx`, `Conversation.tsx` (`Message`/`UserMessage`), `components.css`, the production composer context, `scripts/lab.sh` and `web/lab/session.mjs`. The screenshot was inspected only, never copied into the publication.

Native evidence: the installed Pi's `dist/core/agent-session.js`, `parseSkillBlock()` and `_expandSkillCommand()`, stores a leading `<skill name="…" location="…">` block and an optional trailing user message. Frontmatter is stripped, so a resource-list description cannot be assumed to survive in history. The card therefore derives its second line only from a heading already in the recorded body; without a heading, the future implementation should omit that line. Pi trims arguments when expanding; this prototype does not promise recovery of the exact original slash-command bytes. The expanded recorded source remains the authority. Unrecognized text must stay ordinary text, not be hidden merely because it mentions `<skill>`.

The round is a frozen HTML presentation copy, not React: the real conversation header/action order and SVG paths, 296px rail, 780px conversation measure, right-aligned 560px user message, 6/9px message padding, production tokens and embedded fonts provide the context. Only the inside of the user message is the comparison surface. The prototype does not put the skill disclosure under the existing eight-line whole-message clipping: extra text remains separate from the long expansion. Header, copy symbol and send controls are inert context, explicitly disclosed; the composer accepts a local draft but sends nothing. Narrow headers wrap, the rail disappears, and the conversation scrolls independently.

No new host facts are assumed: name, source path, body and extra text come from the recorded user-message text already delivered to the browser. No claim is made that the skill is installed now, that its source file is accessible now, or that the person chose it from a palette rather than typing it. Source paths are hidden by default, not removed from history or treated as secret redaction. A future copy action should retain the recorded message; copy behavior is not tested here.

All messages, skill bodies, workspace names and `/example/skills/…` paths in the artifact are invented. Only the generated synthetic HTML was published, not repository files, the real screenshot, issue text, credentials or machine data. No product code, contract, authority or deployment changed.

## Rebuild and evidence

```sh
node design-system/prototypes/build.mjs design-system/prototypes/rounds/2026-10-22-taidon-kutsu
node design-system/prototypes/rounds/2026-10-22-taidon-kutsu/publish-build.mjs
# On a disposable browser-capable machine with Playwright:
node check.mjs 2026-10-22-taidon-kutsu.html evidence
node check.mjs https://glasspad.example.test/p/b552pubbvo7ely3wdqsay57zhm/
```

`check.mjs` is in the round directory. Browser execution used Cedar's disposable `/var/tmp/oh-proto-skill-01m5h221967`, reusing the earlier round's disposable Playwright/Chromium dependency without changing the installed machine setup or opening a personal browser profile.

- **180 offline state checks:** 3 directions × 1440/1366/390px × light/dark × 10 checkpoints (three skill scenarios closed/open/reclosed and an ordinary-message scenario). Keyboard disclosure, native-source visibility, separate argument text, long-name wrapping, plain-message fallback presentation, draft retention, rail/header geometry and document/message/control overflow are checked. Zero console/page errors.
- **180 hosted state checks:** the same matrix and interactions in the actual Glasspad sandbox. Zero console/page errors.
- **Nine screenshot/static-HTML pairs** in `evidence/`: each direction at 1440px/light/collapsed and 390px/dark/collapsed plus expanded. The snapshots are script-free and font-embedded. Images are AVIF, converted from Chromium PNG captures. These are authored-prototype captures, **not production synthetic-lab captures**; no host-backed or live-product test is claimed.
- Self-review inspected the desktop/light and phone/dark collapsed/expanded card captures, disclosure/raw-source boundaries, production context, and synthetic-only publication. The isolated visual round does not claim an independent model review or a product gate.
- Prototype build, JavaScript syntax checks, project-view validation, issue doctor and `git diff --check` passed. Doctor's existing attachment advisories are unrelated to this round.

Hosted HTML SHA-256: `630974575fd4c425227c67e8d77b0ce2406d719a4f188de5cc1aff2cec388c7d`. Stable Glasspad key: `open-habitat-proto-skill-invocation-display`.

## Failure inventory and limitations

The first offline browser attempt failed because its unscoped `textarea` selector also matched the hidden legacy library composer. Scoped it to `.s-demo textarea`; the full rerun passed and the final offline/hosted matrices passed. This was a round-local test-harness defect, not a product failure. The original log path was reused for the successful rerun; the short error is preserved here: `strict mode violation: locator('textarea') resolved to 2 elements`.

Glasspad's first publish succeeded but its automatic local `xdg-open` failed on displayless Alder (`no method available`). Later publications use `--no-open`, and remote browser checks verify the actual hosted URL. No publication or browser-check requirement remains blocked. Logs/receipt: `/var/tmp/skill-display-publish.json`, `/var/tmp/skill-display-browser.log`, `/var/tmp/skill-display-final-browser.log` on Alder.

Optional discovery reads initially used a nonexistent `Conversation.css` and a nonexistent generic `pi-processes` skill path. Continued from the actual `components.css` and the installed skill's advertised npm path; neither input remained missing. Hosted embedded fonts are blocked by Glasspad's existing sandbox constraint, so `publish-build.mjs` removes `@font-face`; the page discloses system-font fallback. Offline evidence retains Instrument Sans and JetBrains Mono. No local Alder lab/specialist run was attempted; the comparison uses the source-grounded presentation method of the previous round.

The file-read tool cannot display AVIF as an image (it returned binary text during optional expanded-image inspection). Used the identical original PNG from the disposable capture directory to finish that inspection; committed evidence remains AVIF. This did not affect the browser captures or checks.
