# Result

Round `design-system/prototypes/rounds/2026-10-16-agentit/` prototypes the recommended path from [ADR 0016](../../docs/decisions/adr-0016-native-harnesses-and-subscription-authorization.md): Claude Code and Codex as separate native agents next to Pi. A fourth page shows the alternative, Claude as a Pi model through an extension, wherever its UI differs.

Build it from `design-system/prototypes/` with `node build.mjs rounds/2026-10-16-agentit`, which writes `dist/2026-10-16-agentit.html`. Keys 1–4 switch pages. The page bar's **Tilauslupa** switch belongs to the prototype, not the product. It shows the sign-in views before and after provider approval.

## Axis and directions

**Axis: where the agent of a new conversation is chosen.** These parts are the same on every page:

- **Sign-in per agent** lives under Asetukset → Agentit, reachable from the account menu and from every "Kirjaudu…" link. Each agent has a subscription row, an API-key row, a default model, what it lacks, and its native directory.
- **The conversation shows its agent.** The top bar has one chip (agent · model · thinking level) that opens Tiedot. The turn head reads `CLAUDE claude-sonnet-5` instead of `PI GPT-5.5`. Tiedot shows how the agent is signed in, the native ID (`claude:…`, `codex:…`), and an "Ei käytössä" list giving each missing feature with its reason.
- **Unavailable controls stay visible with their reason.** While Claude Code works, Ohjaa is disabled with "Ohjaus ei käytössä" beside it, and the field says the message is sent when Claude is done. Stop and Työn jälkeen work for every agent.

| Page | What it decides |
|---|---|
| 1 Kentän valitsin | A new conversation's field has an agent pill (`Pi ▾`) that opens a menu with each agent's model, sign-in state and missing features. The pill disappears after the first message, and the agent then shows only in the top bar. The sidebar rows are unchanged. This is the smallest change. |
| 2 Plus-valikko | The sidebar's + (and the workspace menu's Uusi keskustelu) opens the agent menu first, so the conversation is born with its agent. Sidebar rows carry a small agent tag (`Pi`, `Cl`, `Cx`). Agent identity is visible in navigation at the cost of a choice on every new conversation and tags on every row. |
| 3 Aloituskortit | An empty conversation shows three agent cards: model, sign-in state, and missing features struck through. A signed-out agent's card has Kirjaudu…, and the field is disabled until a signed-in agent is chosen. This explains the most, but it is the heaviest option for someone who always uses Pi. |
| 4 Vaihtoehto: Pi-laajennus | There is no agent choice, only a model pill whose menu lists `claude-sonnet-5` / `claude-opus-5-5` as "Claude · laajennus". The conversation stays Pi (`PI claude-sonnet-5`) with every Pi control. Settings show only Pi, with a Claude-extension block: subscription "Ei sallittu" (the Agent SDK restriction) and an Anthropic API key. |

In every native-agent page, the subscription route for Claude Code and Codex is "Ei käytössä tällä palvelimella" with the provider's restriction as the reason, until Tilauslupa is set to Hyväksytty. The flows differ by agent. For Claude, open the sign-in page and paste the returned code, which is Claude Code's remote fallback. For Codex, a device code waits for confirmation.

## Host facts the view assumes

None of these exist yet; the contract is Pi-specific (`agentId` pattern `^pi:…`, Pi command and onboarding types).

- Per conversation: harness identity (`pi` / `claude` / `codex`), the model, and a namespaced native ID.
- Per harness, from the daemon: sign-in state and route (subscription or API key), default model, the model list, and an explicit capability set (`steer`, `recap`, `ask`; stop and follow-up assumed for all).
- An installation setting saying whether each provider's subscription route is enabled. The view shows its reason text when disabled.
- Login operations that run the harness's own login as the user. Claude: sign-in URL, then a pasted code. Codex: device code, then completion. A one-shot API-key handoff to the native login.
- A working and settled signal per harness, equivalent to Pi's, for the info row and the sidebar state.
- Claude Code steering is assumed unavailable. Codex steering via `turn/steer` is assumed available but unverified.

## Architecture sketch

The sketch is ADR 0016. **The prototype updated it:** a new section, "Refinements from the prototype", keeps the decision and adds:

- one harness per conversation, fixed at the first message;
- defaults live in each harness's own configuration;
- credentials pass through to the native login and never stay in the host;
- subscription sign-in is gated per installation by the operator after written approval, and the gate covers only what the browser offers;
- permissions stay with the harness, with no bypass flags;
- capabilities are explicit.

The ADR status remains Proposed.

## Questions for Jari

1. Which page? My recommendation is **1 Kentän valitsin**. Most conversations stay on Pi, the choice sits where the message is written, and navigation stays quiet. Page 2's row tags become useful only if conversations are mixed in practice.
2. In a non-Pi conversation, should the browser show Claude Code's and Codex's permission prompts, or is "the agent's own settings decide" enough for the first version? The prototype assumes the latter. Answering prompts in the browser needs an adapter-level permission bridge, which would be a separate design.
3. Should we write to Anthropic and OpenAI now? The prototype shows that the subscription route is the main value. Without approval, Claude and Codex in this product mean API billing only.
4. Should Codex be in the first step at all, given that Pi already covers OpenAI models? Codex adds a second OpenAI agent whose main gains are `turn/steer` parity and the Codex history.

## Decisions for later review

- **A fourth page for the alternative.** The issue asked to "show the alternative where the UI differs". I put it as page 4, clearly marked as not on the axis, rather than mixing it into the three directions.
- **Tilauslupa is a page-bar control, not product UI.** Who enables a subscription route was left to the ADR: an installation setting by the operator, not a per-user switch. The settings view only shows its effect.
- **Pi's existing ChatGPT sign-in is not gated.** It already ships. ADR 0016 asks for OpenAI's review of it, which is not a UI change.
- **No "continue in terminal" command in Tiedot.** It would invite simultaneous browser and terminal writes to one native session, which the research warns interleave. Only the native ID is shown, as for Pi today.
- **Agent tags are neutral two-letter marks** (`Pi`, `Cl`, `Cx`), not provider logos.
- **The synthetic Claude and Codex conversations replay the shared fixture**, relabelled with the agent and model. Their content is Pi's status-script conversation.
- **The round draws its own composer behaviour** on top of the library's composer CSS. The library composer's `working()` only knows conversation c1. Library proposal: `lib/composer.js` should take the agent's capabilities and the live conversation from a hook (`APP.caps(c)`) instead of hard-coding c1 and Pi's wording. This lets a chosen direction move to `lib/` without the override.
- **The `/prototype` skill could not be invoked** from this session (it is reserved for explicit user invocation). The round follows `design-system/prototypes/AGENTS.md` instead.
- **Review level.** The prototype HTML and JS got a focused self-review (synthetic content, no network, no real identities). The ADR refinements touch credentials and authority, so they got one independent `/llm-review`. The finder was gpt-6-astra, and claude-fable-5-1 answered one focused question on the credential and gate bullets. Neither found a defect. Two clarifications were applied: the subscription gate covers only what the browser offers and never touches native credentials, and the host writes no credential anywhere.

## Verification

`node design-system/prototypes/check.mjs dist/2026-10-16-agentit.html` ran in light, dark and phone modes for all four pages with no console errors. Interactions were clicked in every page:

- page 1: pill → Claude → Tiedot;
- page 2: plus menu → Claude, plus on issuectl → Codex sign-in;
- page 3: Codex card → Kirjaudu… → Lisää avain;
- page 4 in dark: model pill → `claude-sonnet-5` → Tiedot.

A scratch script also covered the first send in a new Claude conversation, the live turn with Ohjaa disabled, the settings page with Tilauslupa approved, and the phone sheet.
