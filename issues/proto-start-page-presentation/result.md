# Shorter repository start page

Review: https://glasspad.example.test/p/274f3vpjwgausjy5xm42pzljsi/

## For Jari

Kolme suuntaa samalla keksityllä Aurinkopolku-repolla: **Kortit**, **Rivit** ja **Esikatselu**. Suosittelen **Kortteja**: nimi ja lyhyt ”milloin” riittävät tavoitteen valintaan. Koko pyyntö on piilossa, sen saa tarkistettavaksi, ja **Lisää luonnokseen** toimii myös avaamatta pyyntöä. Rivit säästävät eniten puhelimen tilaa, mutta vaativat avaamisen ennen lisäämistä. Esikatselu erottaa lukemisen valinnasta, mutta lisää liikettä silmän ja sormen välillä.

Kokeile pyynnön avaamista, pitkää julkaisupyyntöä, muita tavoitteita ja luonnoksen säilymistä. Mikään ei lähetä viestiä. Vaihda teemaa ja puhelinleveyttä. **Valitaanko Kortit vai onko Rivien tiiviys tärkeämpi?** Valintaa ei ole tehty; issue on avoin, preparation=pending. Taito, tiedostomuoto ja tuotantokoodi pysyvät ennallaan.

## Comparison axis and recommendation

The axis is **where the full prompt lives before insertion**, not a new dashboard or agent workflow. All three directions share the same authored introduction, six ordered goals, prompt texts, optional skill, shell and composer.

1. **Kortit / Cards:** production StartHere card grid, title + when, optional inline prompt disclosure and direct insertion. Independent cards do not stretch to the longest expanded prompt. Recommended: closest to the existing interaction, no mandatory preview step.
2. **Rivit / Rows:** a single-open native disclosure list. Title and when remain visible; opening reveals the prompt and insertion action. The narrow initial page is substantially shorter, at the cost of one additional action.
3. **Esikatselu / Preview:** goal choices beside a shared preview on desktop, above it on phone. Initially no goal is chosen. Selected goal is explicitly marked; its full prompt and insertion action appear in the preview. Deliberately not auto-insert-on-selection.

Shared proposed bounds:

- Author the always-visible introduction as 1–2 sentences, roughly **240 characters**, title roughly **60**, when roughly **100**. These are authoring recommendations, not runtime truncation. Extra repository explanation has an explicit disclosure; security-critical instructions must stay in the visible introduction, not be hidden by an automatic summarizer.
- Show **three primary goals** initially; further goals remain behind a labelled count (three more in this fixture). Recommend **3–6 authored goals**, not an exhaustive task catalogue. This does not change the existing parser's eight-goal bound or silently drop any goal.
- Full prompt is revealed only on demand. The expanded reading area is bounded to **16em** (about ten UI-text lines) and scrollable, without blockquote indentation. Long words and paths wrap. The whole original prompt, including its tail, remains available and is inserted unchanged. Prefer short prompts (roughly 1,200 characters or less); never silently truncate an executable draft.
- Insertion uses existing `goalDraft` semantics: optional `/skill:name` prefix, then prompt, then two newlines and the existing nonblank draft. Focus returns to the composer. No send or host request occurs. A status message confirms the local insertion.

Measured initial start-page content heights (not browser height): desktop Cards **439px**, Rows **479px**, Preview **523px** at both 1440 and 1366; 390px Cards **802px**, Rows **510px**, Preview **639px**. Cards are shortest on desktop, not on phone. All phone directions retain the fixed composer and a separately scrolling start-page area. These measurements describe this synthetic content, not guaranteed bounds for arbitrary repository text.

## Production grounding and scope

Inspected the reported Alder screenshot privately. None of its repository name, prose, prompts or business data was copied to the prototype, captures or hosted space. Also inspected the existing paired **production synthetic-lab captures** in `issues/start-page-skill/evidence/page-{1440-light,390-dark}.{avif,html}` and their result, rather than capturing a live account.

Read `StartHere.tsx` / `.css`, `StartPageRead.tsx`, its Storybook example, `PendingConversation.tsx`, `AgentHeader` in `Navigation.tsx`, `ControlElements.tsx` / `Controls.module.css`, current composer rules in `components.css`, design instructions, tokens and the editor-buttons round-2 sources/result. The round starts with a presentation copy of the production StartHere stylesheet. It retains the **296px rail, 780px conversation column, production card geometry, token typography/colors, row-control sizing, bottom-anchored empty timeline and current field/model/send geometry**. The pending-conversation header supplies title, workspace and the production info SVG, not a fictional Git/model/activity toolbar: those actions belong to an already-created agent. Navigation, info, model and sending are inert context, clearly labelled; the sidebar is a simplified presentation copy, not an interactive navigation implementation.

This is an authored HTML comparison, **not mounted React, not a new lab run and not product integration evidence**. Existing synthetic lab captures ground the baseline; new paired captures below prove only this round's authored presentation. Offline output embeds Instrument Sans / JetBrains Mono from the real tokens. Hosted output removes embedded font faces because Glasspad's sandbox blocks them, and discloses the system-font fallback. No network calls, real profile, native agents or private files are used by the page. Published content is **only one generated synthetic HTML file**, not this issue, source files, baseline captures or any repository directory.

No new host facts, command, contract, authority, registry or persistence are assumed. Title/body/goals/optional effective skill already exist. Disclosures, selected goal and draft are local presentation state. Supporting a separately authored short introduction/additional explanation may need a later format decision; this prototype does not decide that schema. A text-only page, absent-page hint, loading and error states are unchanged and outside the comparison. Any implementation, including skill/format changes, waits for Jari's choice and separate work.

## Rebuild and verification

```sh
node design-system/prototypes/build.mjs design-system/prototypes/rounds/2026-10-22-aloitussivu
node design-system/prototypes/rounds/2026-10-22-aloitussivu/publish-build.mjs
# On a browser-capable machine with existing Playwright/Chromium:
node check.mjs 2026-10-22-aloitussivu.html evidence
node check.mjs https://glasspad.example.test/p/274f3vpjwgausjy5xm42pzljsi/ hosted-evidence
```

The browser script is in the round directory. It ran on Cedar under disposable `/var/tmp/oh-proto-start-01m5h222`, using the prior prototype's existing Playwright installation and cached Chromium, without installing tooling or using a personal profile.

- **90 offline checkpoints passed**, 3 directions × 1440/1366/390px × light/dark × 5 checkpoints; **90 hosted checkpoints passed** on the published page. Zero console/page errors in either final matrix.
- Checks cover collapsed initial state, keyboard disclosure/selection, insertion retaining the draft and focusing the field, no sending, bounded complete long prompt including the final path, no document/demo/main/prompt horizontal overflow, one-open row behavior, secondary goals and the optional native-skill prefix. The comparison picker is checked not to overlap the composer.
- **Ten AVIF + script-free static HTML pairs** in `evidence/`: each direction initially at 1440/light, long-prompt state at 1366/dark and 390/dark, plus Cards initially at 390/light. All other theme/width combinations are browser-checked, not individually captured. HTML embeds offline fonts and retains the captured textarea value. `checks.json` records the offline matrix/measurements. These are prototype captures, not newly generated lab captures.
- Self-review inspected desktop/light, phone/light and phone/dark images, checked the existing lab baseline, narrow wrapping, prompt indentation, bottom anchoring, selection/disclosure semantics, synthetic-only contents and draft retention. Corrected the comparison-page layout so its floating picker stays outside the composer at phone width. No independent model review or product gate is claimed or needed for this isolated presentation round.
- Prototype build, JS syntax checks, project-view validator, issue doctor and `git diff --check` passed. Doctor retains existing unrelated attachment-format advisories.

Published HTML SHA-256: `55e93337491df66671fb1c15a2962118ddfbad5abf9708b3d8a5e45306d0443d`. Stable Glasspad key: `open-habitat-proto-start-page-presentation`.

## Failure inventory and limitations

No required delivery/check/publication remains failed or incomplete. Browser run 1 stopped because the test's unscoped `textarea` locator also matched the library's hidden generic composer. Scoped it to `.s-demo textarea`; run 2 and both subsequent complete offline/hosted matrices passed. This was a test-harness selector defect, not a product defect. Log: `/var/tmp/proto-start-browser.log`; successful final matrix: `/var/tmp/proto-start-delivery-browser.log`.

Optional discovery initially guessed absent `ControlElements.css`, `Composer.css` and `Composer*.tsx` names; read the actual `Controls.module.css`, `components.css`, `PendingConversation.tsx` and `StartPageRead.tsx` instead. No source remained uninspected because of those misses. First hosted publish succeeded but its automatic local browser launch failed on displayless Alder (`xdg-open: no method available`). Later publishes use documented `--no-open`; Cedar's actual hosted browser checks passed, so publication and browser verification are independently complete. No service or machine configuration was changed to work around it. The established hosted-font limitation is handled explicitly, not claimed as production typography.

Other logs on Alder: `/var/tmp/proto-start-publish.json`, `/var/tmp/proto-start-final-doctor.json`, `/var/tmp/proto-start-avif.log`, `/var/tmp/proto-start-baseline.log`. No issues were filed and no push or deployment was performed.

Integration: the first `run merge` encountered the expected concurrent `KOKEILTAVAA.md` prototype-section conflict. Kept both the skill-invocation review link and this start-page review under one Prototyypit heading, retaining main’s Testikone heading and all other entries. No source/evidence conflicts occurred; revalidated project view and whitespace after resolution.
