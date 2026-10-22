# Tavoitteesta oppaaseen — round 2

Review: https://glasspad.example.test/p/s5272m6an7j6t3xbpyfypnnivu/

## For Jari

**Suosittelen Opasta.** Kaikki kuusi tavoiteotsikkoa ovat aloitussivulla näkyvissä. Jokainen avaa oman ohjesivun: mitä saat, milloin käytät ja miten etenet. **Aloita** lisää pyynnön muokattavaan luonnokseen; mitään ei lähetetä ja aiempi tekstisi säilyy. Pitkä agenttipyyntö on erikseen tarkistettavissa, ei itse ohje.

Vertaa **Opasta**, **Vaiheita** ja **Hakemistoa**. Opas antaa kokonaiskuvan ilman pakollisia välivaiheita. Vaiheet vähentää kerralla luettavaa mutta lisää klikkauksia; Hakemisto nopeuttaa oppaan vaihtamista mutta vie tilaa, etenkin puhelimessa. Legoralta otin nimettyjen tehtävien ja selkeiden tuotosten ajatuksen, GitHubilta erillisen käyttöohjesivun — en työnkulun rakentajaa.

**Valitaanko Opas pohjaksi, vai auttaako Vaiheiden osiin jakaminen sinua enemmän?** Kokeile myös virheen korjausta, pitkää julkaisupyyntöä, paluuta tavoitteisiin sekä 390 px:n ja tummaa näkymää. Tämä on uusi kierros, ei toteutusvalinta. Issue jää avoimeksi, preparation=pending; taito, tiedostomuoto ja tuotanto eivät muutu. Kierros 1 säilyy alempana.

## Research: public guided-work patterns

Primary sources fetched on **2026-10-22**, before designing this round. These are public product pages, documentation and promotional media, **not authenticated product exploration**. Distinguish observed presentation from our design inference:

| Product / primary source | What the source actually shows or says | Applied here / deliberately not copied |
| --- | --- | --- |
| [Legora Workflows](https://legora.com/product/workflows) | A named workflow catalogue: e.g. **Create timeline**, **Supplier agreement analysis**, **Internal compliance review**. Each description explains the task and output (timeline, structured report, table). “Share and execute” says users choose firm or pre-built workflows from a library, then provide documents or context. The page also describes building, sharing and iterating workflows. | Task/outcome names are the entry point, not raw prompt text. Our catalogue uses all six visible goal titles with one short “when”. An opened guide explains outcome and required user context before Aloita. We do **not** infer that Legora uses our exact what/when/steps guide layout. |
| [Legora public motion sample](https://framerusercontent.com/assets/UcgEqpI2PCVq7aHjPtHXPKKu2TA.mp4), embedded on that product page | Inspected a frame at 3s from its 6.9-second loop: a **builder** with “Back to list”, “Add a title”, “Instructions” and “Tags”. The accompanying poster is a metaphorical mixing desk, not an application screenshot. | Supports a separate named instruction object and explicit return, but is **not evidence of an end-user guide page or execution wizard**. No builder, tags, graph editor, progress tracking or workflow runtime is proposed. |
| [Harvey Agents](https://www.harvey.ai/platform/agents) (the former `/products/workflows` URL redirects here) | Current public page pairs named use cases with outputs and says: “Preview the plan, adjust the scope, and approve work before Harvey begins.” This is a product claim, not a verified walkthrough. | Make the boundary between understanding, preparing and running explicit. Our Aloita only prepares a draft; the existing send remains the actual execution boundary. We do not import Harvey’s approval engine, memory or parallel-agent capabilities. |
| [Linear issue templates](https://linear.app/docs/issue-templates) | Docs describe template selection in the issue-creation modal, contextual description, placeholders, and a distinct **Instructions** field in form templates. Template selection pre-fills work rather than merely displaying a prompt. | Keep reusable explanation separate from the editable request. Missing facts (“[kuvaile havainto]”, “[polku]”) remain visible in the draft. We do not introduce a form engine, required-field schema or automatic issue creation. Linear is a useful boundary comparison, not evidence for a separate guide-page UI. |
| [GitHub Copilot prompt-file library](https://docs.github.com/en/copilot/tutorials/customization-library/prompt-files) → [Onboarding plan](https://docs.github.com/en/copilot/tutorials/customization-library/prompt-files/onboarding-plan) | Named entries with short purpose statements navigate to dedicated documentation pages. The Onboarding plan page has its own title, purpose, complete reusable prompt and **How to use this prompt file** with concrete save/invoke instructions. | The closest observed match for title → own guide → use. Our human-facing guide has what/when/steps and an optional complete prompt disclosure. The exact ordering and Aloita interaction are our proposal, not copied GitHub behavior. |

**Synthesis:** choose by intended outcome, read a separate human-facing guide, then explicitly prepare the work. The research does not justify turning a native conversation host into a workflow platform. A guide describes expected steps; it does not claim that an agent is already executing them. All external media stayed in disposable scratch; the published prototype contains no external screenshots, videos, branding, real accounts or fetched data.

## Comparison axis

**How the separate guide is read and navigated.** The landing page, six titles, synthetic Aurinkopolku content, prompts, optional `/skill:korjaa` behavior, shell and composer are identical across directions. Unlike round 1, no goal is hidden under “Muut tavoitteet” and no goal inserts directly from its card.

| Direction | Own guide page | What it decides | Cost |
| --- | --- | --- | --- |
| **Opas — recommended** | A continuous page with what, when, numbered steps, optional raw prompt, then Aloita. “Kaikki tavoitteet” returns to the catalogue. | Read the whole short guide at once. | A long guide scrolls; comparing another goal requires returning. |
| **Vaiheet** | Same guide content shown as three navigable parts (Mitä / Milloin / Eteneminen). Next/previous work; direct part navigation is allowed. Aloita is on the last part. | Reduce the amount shown at once. | More navigation for very short text. The part indicator explicitly says it is **not agent execution state**. |
| **Hakemisto** | Guide body plus all goal titles in a left index on desktop; index wraps above the guide on phone. Switching opens another own guide view, never inserts a prompt. | Quickly compare guides without returning to the catalogue. | Consumes width on desktop and substantial height on phone; not recommended for a small six-item catalogue. |

All guides are replacement reading views, **not an inline card expansion, shared preview panel or modal**. Links use page-local fragments; native browser back/forward works within the prototype, and the explicit return restores focus to the chosen goal. These are not proposed host routes or promised independently shareable Glasspad guide URLs.

The landing page is bottom-anchored like the empty production timeline; guide pages start at the top. The composer stays available for free writing while reading. Aloita preserves the existing `goalDraft` semantics: optional native-skill prefix + unmodified full prompt + two newlines + previous nonblank draft. It returns to the catalogue and focuses the draft. Browsing, changing guide or going back never changes the draft. Switching **prototype directions** re-mounts the synthetic demo and intentionally resets it; this is comparison-harness behavior, not proposed product draft loss.

## Production grounding and scope

Read current `web/src/components/StartHere.tsx` / `.css`, `web/src/app/StartPageRead.tsx` and `PendingConversation.tsx`, the round-1 source and result, design instructions, token geometry, prototype build/picker and lab/session instructions. Inspected the existing paired production synthetic-lab baseline in `issues/start-page-skill/evidence/page-1440-light.{avif,html}`; the 390/dark baseline and round-1 evidence remain available there and in this issue. No new lab or live-user capture is claimed. Alder browser execution is prohibited for this work; authored-prototype checks ran on Cedar using the already installed Playwright/Chromium and disposable scratch, as in round 1.

The round reuses round 1’s presentation copy of the current production shell (296px rail, 780px conversation column, token colours/type/spacing, header and fixed composer); all changes are round-local. The header is the pending-conversation context, not a fictional live-agent toolbar. Sidebar/model/info/send are labelled inert context; only goals, guides, local draft and review controls operate. This is an **authored static prototype, not mounted production React or product integration evidence**.

Existing title/when/prompt/effective skill are enough for today’s cards, **not for these richer human-facing guides**. The “what” and numbered steps are new authored synthetic content. A later approved skill/format change must decide how that content is authored and read; no browser-generated summary, new contract, storage registry, cache, workflow service or authority transfer is decided here. Local fragment/reading state and the draft are synthetic presentation state only. No file, native agent, API or host command is opened. Empty/loading/error states are unchanged and outside this comparison.

Only the single generated synthetic HTML was published. Offline output embeds the bundled Instrument Sans and JetBrains Mono; hosted output removes embedded font faces because the Glasspad CSP blocks data fonts and discloses the system-font fallback.

## Rebuild and verification — round 2

```sh
node design-system/prototypes/build.mjs design-system/prototypes/rounds/2026-10-22-aloitussivu-2
node design-system/prototypes/rounds/2026-10-22-aloitussivu-2/publish-build.mjs
# On a browser-capable machine, with check.mjs beside an existing Playwright installation:
node check.mjs 2026-10-22-aloitussivu-2.html offline-evidence
node check.mjs https://glasspad.example.test/p/s5272m6an7j6t3xbpyfypnnivu/ hosted-evidence
```

- **252 offline + 252 hosted checkpoints passed**, 3 directions × 1440/1366/390px × light/dark, visiting **every one of the six guides**. Zero page/console errors. Also ran an initial 252-check system-font offline matrix before publication.
- Checks cover all titles without disclosure; keyboard link entry and guide-title focus; all three instruction sections; Next/previous/direct part selection; index switching; explicit return and focus restoration; native history back/forward; exact draft preservation, empty draft and optional skill prefix; full long prompt including its final path and bounded scroll; document/demo/main/reading-area overflow; disabled sending and no picker/composer overlap. Aloita also works without opening the raw prompt.
- **14 AVIF + script-free static HTML pairs** under [evidence-round2/](evidence-round2/): catalogue at 1440/light and 390/light; each direction’s guide at 1440/light and 390/dark; each direction’s long prompt at 1366/dark and 390/dark. Remaining combinations were browser-checked, not individually captured. HTML retains the textarea value. [Offline matrix](evidence-round2/checks.json) and [hosted matrix](evidence-round2/hosted-checks.json) record final results.
- Self-review inspected catalogue/guide desktop and phone captures, long-prompt wrapping, dark theme, and the existing production lab baseline. Corrected a phone flex-shrink issue found in the long-prompt capture so Aloita stays on one line, then rebuilt and rechecked offline/hosted output. The phone Hakemisto visibly spends too much space on switching between only six goals; that tradeoff is why Opas is the recommendation. No independent model review or product gate is claimed for this isolated presentation exploration.
- Prototype builds, JavaScript syntax checks, project-view validation, issue doctor and whitespace checks passed. The full product gate was not run: no production files changed.

Published synthetic HTML SHA-256: `0370a8c8d7c1cf17fd9d143b2b7508203646ba031810bb402155bc3f15b5c634`. Stable Glasspad key: `open-habitat-proto-start-page-presentation-r2`. Browser scratch: `cedar:/var/tmp/oh-start-r2-01m5h3ry`. Final delivery/browser/encoding log: `/var/tmp/oh-start-r2-verified-delivery.log`; preliminary long-prompt capture log: `/var/tmp/oh-start-r2-long-captures.log`; full history-check matrix log: `/var/tmp/oh-start-r2-browser-history.log`; initial/final preliminary matrices: `/var/tmp/oh-start-r2-browser-offline.log`, `/var/tmp/oh-start-r2-browser-final.log`; publication receipt: `/var/tmp/oh-start-r2-publish.json` on Alder.

## Failure inventory — round 2

No required research, prototype, browser check, evidence or publication remains failed/incomplete. Optional discovery encountered: guessed Legora `/workflows` and Harvey `/blog/introducing-workflows` paths returned 404; Notion’s help page returned 403. Did not bypass access control or infer unread content: used the successful current Legora/Harvey product pages and Linear’s primary documentation instead, plus GitHub’s library/detail pair. Research notes: `/var/tmp/oh-start-r2-research-notes.md`; fetched source text: `/var/tmp/oh-start-r2-research/`.

Evidence conversion initially used an unavailable `libaom-av1`/`still-picture` combination on Cedar (one failed command: “Unrecognized option still-picture”). Used its installed `libsvtav1` encoder instead; the AVIF/static-HTML delivery completed without changing tooling. Recovery log: `/var/tmp/oh-start-r2-avif.log`.

An optional Legora media frame extraction first sought at 25s, then 8s and produced no output (subsequent scp reported missing file): the promotional loop is only 6.9s. After checking duration, 3s extraction succeeded and was inspected; no unobserved video flow is claimed. Logs: process `proc_166a`, scratch notes above. This is an extraction seek mistake, not a product defect. Optional local source discovery initially used the wrong `StartPageRead.tsx` directory and refreshed-skill layout; both actual paths were located and fully read. An attempted direct AVIF image read yielded binary text, so the lab image was converted to PNG on Cedar and visually inspected. None of these misses reduced delivered evidence. No issues filed, product code changed, push or deployment performed.

---

# Round 1 — retained for comparison

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
