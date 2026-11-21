# Result: owner card and participant strip in the browser

Implemented the browser side of ADR 0038 behind the experimental feature `multiplayer`, whose catalog entry is now `landed: true`. With the switch on, a person can invite another signed-in person on the same server, and both can use the conversation.

## What exists now

- **Owner, people row** (`web/src/app/MultiplayerOwner.tsx`, under the conversation header): avatars with presence (here, away, invited dashed), "N paikalla", full-rights chips, and **Kutsu**. The panel lists members with role and state, plus **Anna täydet oikeudet** (behind a confirmation that names what is lent: files, GitHub, connected services, own machines, quota and AI credentials), **Ota oikeudet pois** and **Poista keskustelusta**. The facts come from the owner's daemon: `members`, `shared` and `people`. They are reread every 4 s and whenever history moves.
- **Kutsu**: the same-server picker (`/people`), listing everyone who has signed in. Each person row has one **Kutsu**.
- **Take-back at once (Heti)**: after taking rights back or removing someone, a card shows a plain list of the running processes, each with **Pysäytä**. If the daemon says the running run is that person's, or the running Pi could not be told, the card also says the run continues as text only and offers **Pysäytä ajo**. Nothing is stopped automatically.
- **The card where the agent stopped**: one card per waiting request, placed right after the agent's text-only answer to it, with **Salli kaikki / Hyväksy yksitellen / Älä salli** (`/requests`). Older requests stay open.
- **Per-call approval**: an approval question gets its own card instead of the generic choice. It shows the tool and the complete arguments with line breaks kept, has **Salli / Älä salli / Salli kaikki**, and lists the answers already given in this run. An answer is bound to the question's `request_id` and marked in session storage before it is sent, as the generic question is.
- **Habitat lines and attribution** (`web/src/components/Multiplayer.tsx`, `HistoryView.tsx timelineItems`): participant messages show name, role chip and the person's colour edge, and the participant's own messages read "Nimi (Sinä)". Joined, full rights given or taken, removed, continue (all tools or each call) and declined appear as Habitat lines. Live `history.entry` frames carry the facts.
- **Participant** (`web/src/app/SharedConversation.tsx`): *Jaettu kanssasi* in the rail. The invite page (`/shared/<share_id>`) shows the inviter, the conversation's name and whose agent, model, quota and connections these are. Nothing of the conversation shows before joining, and the page offers **Liity / Ei nyt**. After joining, the participant reads the conversation through the share: history with older pages, long blocks through the share's `blocks` route, the live stream (streamed text plus rereads on events), and presence. The strip above the composer shows the mode (text only or full rights), how many of the participant's requests wait, that the owner is approving calls, **Pysäytä vuoro**, and the participant's held messages with **Peru**. If the participant is removed, the conversation is archived or the owner's service is gone, the page says the conversation is unavailable.
- **Daemon**: the multiplayer switch is read from the controller's home, as the membership record already was. In production this is the same directory; in the browser host it is the disposable home and no longer the test runner's.
- **Browser host**: each synthetic person gets a guest socket served by the daemon's real guest route table (`FixtureGuestHandler`). When the person's switch is on, the fake Pi answers the companion's `participant_message`, `release`, `conversation_line` and `grant` ops (`test/browser-host/fakepi_bridge.go`), including an approval select with a multi-line command.
- Explain cards MP01–MP12, in both languages.

## Decisions for later review

1. **Colour family `--ah-glyph-1…7`**, used as a ring and an edge, never a fill. The alternative was `--ah-source-1…3`. The glyph family has seven hues instead of three and is themed in all three themes.
2. **The take-back card follows round 1 (Heti) with a plain list of all the conversation's running processes**, not only those started by the participant: the daemon does not attribute processes to people. Round 2's recommendation (1 Kortti: per-process provenance, Jätä käyntiin, a band reminder) waits for Jari's verdict.
3. **The run part of the take-back card shows only when the daemon's turn fact names that person** (or the revocation failed). Before review it showed for every running run, which promised text-only for the owner's own run.
4. **Names stay in the nominative** ("henkilölle Ville", "Pyytäjä: Ville"). The browser cannot inflect an arbitrary Finnish name.
5. **The approval card lays out a JSON object's values as `key: value`** with their own line breaks. Nothing is omitted or interpreted, and other JSON is shown verbatim.
6. **The owner's facts are polled** (every 4 s, and at once when history moves) rather than pushed by new journal kinds. This follows the predecessor's decision 5.
7. **The participant's live view streams text deltas only.** Tool and thinking rows appear when their entries are saved, through a reread on each event.
8. **The participant's field is text only**, with no attachments, pasted pictures or dictation (ADR 0038 §3).
9. **In the participant's view, owner messages show the owner's name** and no attachment chips. View and file offers show the agent's notice text without an open or download action, because those actions would act on the participant's own account.
10. **The people row shows on every conversation while the switch is on**, because it is where Kutsu lives. Alternative: a header menu item.
11. ***Jaettu kanssasi* shows only with the participant's own switch on**, and the list is reread every 20 s and on navigation.
12. **The fake Pi's bridge listens only when the person's multiplayer switch is on**, so other browser cases keep the unavailable bridge they had.
13. **The checked-in UI references were not regenerated.** Regeneration also pulled in older unrelated drift, and release packaging regenerates them.

## Review

Critical rigor, because this changes what one person sees and can do in another person's conversation. The independent `/llm-review` used gpt-6-astra as finder and claude-fable-5-2 as verifier (two calls). `/assess-findings` produced 10 FIX (two with care) and 1 DISCUSS. All FIX rows were fixed in the second commit, with regression assertions in `multiplayer.spec.ts` for attribution and the text-only field. The DISCUSS row was filed as `unusually-wary-care`: the daemon's owner `shared` route forgets a removed person's waiting request once the record entry is pruned. That needs a product decision.

## Checks

- `./scripts/test-focused.sh --area web`: 1952 passed. The only failure is the known `finnishScan` "Suomi" item, already fixed on main.
- New `web/src/app/multiplayer.test.ts` runs the contract examples through the readers and checks the owner's bare session ID.
- Browser with `OH_BROWSER_WORKERS=2`: `multiplayer.spec.ts` (owner and participant journeys with Alice and Bob) passes, 2/2. `settings-experimental`, `process-tray` and `permission-question` pass. `browser-conversation.spec.ts` fails 14 cases, and an unchanged main fails the same 14 deterministically (filed as `uncommonly-cagey-songs`). A further steer case is flaky on main too (it failed 1 of 3 there and passed 3 of 3 on this branch).
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon` passes, and `go vet ./test/browser-host`.
- Not run: a live host or the real Pi companion with the browser (the browser host uses a fake bridge). No screenshots were captured.
