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
