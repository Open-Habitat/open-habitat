# Prototype: model discovery and choice

Round `design-system/prototypes/rounds/2026-10-16-mallit/` ("Mallien tunnistus ja valinta"). Build it from `design-system/prototypes/` with `node build.mjs rounds/2026-10-16-mallit` (output `dist/2026-10-16-mallit.html`; `dist/` is not versioned). Keys 1–3 flip the directions. The page bar's **Tilanne** select is a prototype control: Tavallinen, Tunnistus epäonnistui, Tieto vanhentunut, Uusi malliperhe.

## Axis

**How the host learns whether a model works for the account, and how it shows that.** All three directions share the same content, placements and rules; they differ only in where the certainty comes from.

## Common to every direction

- **Four places, one picker.** Asetukset → Agentti · Pi sets the default for new conversations (Pi's own `settings.json`, so SSH sees the same). The top-bar chip "`model · thinking`" opens a popover for *this* conversation, effective from the next message and recorded as a model-change marker in the thread. A new conversation has a model pill inside the composer; that choice applies only to that conversation. The unsupported-model notice opens the picker **inline** (not a modal). "Lähetä uudelleen mallilla X" switches this conversation's model and resends the user's message on explicit action, and an on-by-default checkbox also makes X the default. The notice stays until it is resolved.
- **Newest per family (Jari, 2026-10-16).** The picker offers the newest model of each family: luna, terra, sol, astra (`gpt-6-luna`, `gpt-6-terra`, `gpt-6.1-sol`, `gpt-6-astra`), plus any family that appears later. Older generations (`gpt-5.x`, and `gpt-6-sol` once `gpt-6.1-sol` exists) are behind a collapsed "Vanhemmat mallit (n)" and are not offered by default. The group opens by itself when the current choice is in it, so a stale `gpt-5.5` default stays visible. The catalog is shaped like Pi 1.3.0's (`upgrade-pi-1x`). The rule is applied to whatever Pi lists, so a slightly different 1.3 catalog needs no UI change.
- **Marks** are word, icon and colour together: ✓ worked, ⊘ refused, dashed ○ unknown/not tried, spinner while trying. Refused rows cannot be chosen (the reason is in a toast and title), except when the evidence is old (Tieto vanhentunut).
- **Thinking level** sits next to the model as a segmented control. Levels the model does not support are disabled with a reason (synthetic: `gpt-6-luna` stops at `high`), following the research's "clamp to supported levels".
- **Route groups.** ChatGPT-tilaus (`openai-codex`) is active. OpenAI API-avain (`openai`) is shown with "Lisää avain…" as its own group. Claude is a pointer to Asetukset → Agentit, because ADR 0016 (proposed) makes Claude its own agent, not a Pi model. This is consistent with round `2026-10-16-agentit`.
- **New family** (Uusi malliperhe): `gpt-6.2-astra` replaces `gpt-6-astra` in the offered list (the old one moves under Vanhemmat), and a new family `gpt-6-nova` appears with a "Uusi" tag and a banner. Both names are invented.
- **Default is refused**: Asetukset warns that new conversations will fail, and a new conversation's pill and empty view say the same. Sending is blocked with a pointer to the pill.

## Directions

1. **Käytön merkit**: no probing. Marks come from the person's own conversations ("Vastasi tänään 14.37", "Torjuttu tänään 16.58"); everything else is "Ei kokeiltu". The first real message is the test. If it is refused, the same inline notice offers recovery. *Decides:* zero extra usage and no new mechanism; the cost is that the person learns by failing. Failure: if Pi's catalog cannot be read (expired login), only models known from conversations are listed, with a "Kirjaudu uudelleen…" action. Stale: a 12-day-old refusal becomes selectable again.
2. **Kokeilu**: Käytön merkit plus a per-row **Kokeile**. One model at a time, one short native prompt, only when asked, with the usage cost stated. The result is an observation with its time ("Vastasi kokeiluun tänään 14.05"); the newer of a try and a real turn wins. No sweep and no automatic probing of new models. *Decides:* the person can confirm before committing, at a visible cost. Failure: catalog not refreshed, Pi's last stored list shown, and a try fails without changing marks. Stale: tries older than a week, with Kokeile offered again.
3. **Tilin mallit**: only models the provider says the account has; the rest folded away as "vanhemmat ja tilillesi tarjoamattomat". *Decides:* the cleanest list. **The research found no such list for Pi's route** (see below), so this direction stays as a contrast: it shows what would be gained if Codex, as its own agent, supplies `model/list`. Failure: fall back to Pi's full catalog, all marked "Ei tiedossa".

## Host facts the views assume (matched against `research-model-discovery`)

| Assumption | Used by | Research (report.md, architecture.md) |
| --- | --- | --- |
| The daemon, as the user, reads Pi's catalog and global default and writes the default through `SettingsManager`. | all | Holds; this is the existing helper. |
| Catalog membership is not entitlement; the list is *candidates*. | all | Holds; the core finding. |
| The per-model outcome of a real turn (model plus classified unsupported-model error) can be read from the user's native Pi session files whenever the picker opens, so nothing new is stored. | 1, 2 | Compatible with "no host-side per-model cache" only if it is derived from native history each time; implementation must confirm that reading recent sessions is cheap and that the error classification is persisted natively. **Unverified.** |
| A one-model probe (`--no-session --no-tools …`, bounded, one at a time, opt-in, usage warned) returns answered/unsupported/auth_required/rate_limited/unavailable. | 2 | Holds as the research's optional "verify" shape. Its result is kept only as an observation. Where it lives (daemon memory until restart?) is open. |
| A provider-supplied, account-scoped model list exists for the active route. | 3 | **Does not hold for Pi.** Only Codex's `model/list` is account-aware, and it belongs to Codex. |
| Pi can switch an existing session's model and thinking level natively (RPC/`/model`, `model_change` and thinking entries in history). | all (chip popover, notice resend) | Research: offer only "if Pi's native RPC/session semantics can safely apply it, otherwise require a new session". **Unverified**; see question 2. |
| Pi exposes per-model supported thinking levels. | all | Research: expose only "if reliably available". Unverified. |
| Catalog freshness / last refresh error is observable natively. | stale and failure banners | Research: if Pi gives no trustworthy timestamp, say "catalog may be outdated" instead. The banner wording must follow what Pi actually provides. |
| Newest-per-family can be computed from model ids (`gpt-<gen>-<family>`). | all | Not covered; a Pi 1.3 catalog may need an explicit family field or a naming fallback. |

## Questions for Jari

1. **Direction**: Käytön merkit, Kokeilu, or Tilin mallit (the last only when Codex becomes its own agent)? The research recommends candidates plus an optional explicit verify, which is direction 2; direction 1 is its no-cost subset.
2. **Recovery in the same conversation**: the prototype switches the failed conversation's model and resends on the person's click. The research and the previous selector say "choose another model and start a new conversation; no replay". Is a user-triggered resend in the same native session acceptable once Pi's session model switch is proven, or should the notice offer "Aloita uusi keskustelu mallilla X" instead?
3. Should the chip popover allow changing the model mid-conversation at all, or only show it and link to a new conversation?
4. Should a Kokeile result survive a daemon restart? Keeping it means a store; not keeping it means "Ei kokeiltu" again after every release.

## Decisions for later review

- Axis chosen as the *source of certainty*, because placement was already settled by `pi-model-selector` and the agent round; the real open question is what the marks can honestly say.
- After `research-model-discovery` landed mid-round, direction 2 was changed from an all-model sweep with automatic checks of new families to a one-model, opt-in try, which is the only probe shape the research calls proportionate. Direction 3 was kept and relabelled as a contrast that is not available on Pi's route, rather than dropped, so Jari can see what is given up.
- Jari's newest-per-family rule is applied in all directions to whatever the catalog lists, with older generations collapsed rather than removed. That keeps a stale default and an explicit older choice reachable.
- The new-conversation pill changes only that conversation; the default changes only in Asetukset or through the notice's checkbox. Per-conversation and global choices stay separate.
- The notice's "also make it the default" is on by default, because the refusal is almost always caused by the default.
- `recap = false` in this round. The bug that the recap hides the notice is `model-warning-recap-picker`'s; the inline picker here also means no modal is needed.
- Claude appears only as a pointer, following ADR 0016 (proposed); the API-key group is shown but not interactive.
- Content is synthetic: account truth is "gpt-6 answers, gpt-5.x and gpt-6-nova are refused", and Luna's thinking cap is invented.

## Library proposals

None required. If a direction is chosen: the picker (`.md-pick`, row with mark, thinking segment) is a candidate for `lib/` as the shared model chooser. The library's `set-chip` hard-codes `gpt-5.5`, and its history fixture says `gpt-5.5`; this round relabels them to `gpt-6-astra`. The fixture should move to a current model.

## Verification and review

`node check.mjs dist/2026-10-16-mallit.html` passed for all three directions in light, dark and phone with a clean console. Further runs clicked through the following, all with a clean console:
- recovery: pick, then resend;
- Kokeile, then pick, resend, chip popover and a thinking-level change;
- a new conversation: pill, an untried model, the thinking level;
- the notice's folded group in Tilin mallit.

A scripted pass opened Asetukset in every direction × situation (12 views, light and dark), also with a clean console. Review level: focused self-review of the prototype HTML/JS and synthetic content. No independent `/llm-review`, because this round adds no architecture sketch and touches no credentials, Unix-user boundary or authority; the host facts above are recorded as assumptions for the implementation issue to verify. Production lab viewed for the current `/settings` selector (synthetic lab, `OH_PORT_BASE=27200`).
