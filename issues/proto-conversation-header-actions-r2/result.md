# Result: when the header's first-use guidance appears

Prototype: `prototypes/ensiopastus.html`, built from
`prototypes/page.src.html` by `python3 prototypes/build.py` (tokens and fonts
inlined). The page reuses round 1's page and machinery: the same
conversation, the same header, its measured shortening and working actions.
The picker offers Pohja · Kerran tällä laitteella · 1 · Kerran tilille, uudet
erikseen · 2 · Vasta kun kysytään · 3 · Ensimmäisellä painalluksella. Every
view has light and dark themes, desktop (1024, 1320 and 1680 px) and phone,
and a long or short title. A **Tilanne** selector puts the person in one of
four situations: first conversation, next conversation, other device (same
account), and a release that added a header button. That button is an
invented *Näkymät* (eye) placed after the panels. Under the lead, each
riff's trigger, stop and stored fact are shown. A matrix under the app
compares every riff in every situation. Jari's Finnish guide is
`prototypes/NOTES.md`. The screenshots in `prototypes/kuvat/` are AVIF at
device scale factor 2. `prototypes/shoot.mjs` takes them and presses every
control in every riff, theme, device, width and situation: 1184 presses, with
a clean console.

## The axis

**When the explanation of the header's icons appears, and what makes it stop.**
The row stays as on main in every riff (Jari 1.11.: direction 3). Every riff
keeps ⋯ › *Mitä painikkeet tekevät?*, which opens the whole card on request.

| | Riff | Appears by itself | Stops | Remembers, and where |
|---|---|---|---|---|
| — | **Pohja · Kerran tällä laitteella** (round 1 direction 3) | first conversation opened in this browser: the whole card | Selvä or Esc | one flag in `localStorage` |
| 1 | **Kerran tilille, uudet erikseen** | whenever the row shows an icon not yet explained to this account: the whole card at first, then a small card pointing at a new button, or at the icons another device did not show | Selvä or Esc marks the listed buttons explained; pressing a listed button does too | list of explained button ids in the account's `preferences.json` |
| 2 | **Vasta kun kysytään** | never | — | nothing |
| 3 | **Ensimmäisellä painalluksella** | the first press of each button: the action happens and one line under the button says what just happened; Arkistoi explains and asks before acting | next press or Esc; a used button never shows it again | list of used button ids in `preferences.json` (or `localStorage`) |

What each shows per situation:

| Situation | Pohja | 1 | 2 | 3 |
|---|---|---|---|---|
| First conversation | whole card | whole card | nothing (tooltip and ⋯ wait) | line on each first press |
| Next conversation | nothing | nothing | nothing | line only for buttons not yet pressed |
| Other device | **whole card again** | desktop after phone: card for the four one-offs the phone kept in ⋯; phone after desktop: nothing | nothing | as next conversation |
| Release added a button | **nothing: the new button is unexplained** | small card anchored at the new button | nothing; the tooltip explains it on hover | line on its first press |

Riff 2 changes the tooltip itself: it carries the name **and** the meaning
line, after the 0.3 s delay `icon-tooltips-slow` brings. On a phone a long
press shows the same bubble, and lifting the finger does not press the
button.

## Host facts each trigger needs

What the browser and host already know:

- **Per-device storage.** The browser already keeps small per-device choices
  in `localStorage`: `nah:theme`, `nah:agent-work`, `nah:language`, the
  editor width, and the recap dismissal `oh:recap-dismissed:<conversation>`.
  Losing a key only resets a choice.
- **Account preferences.** `GET/PUT /api/v1/account/preferences`
  (`contracts/v1/account-preferences.schema.json`). The daemon writes them,
  running as the person, to `~/.config/open-habitat/preferences.json`. The
  schema has `engine`, `language`, `recent_count` and `experimental`, a map
  of up to 32 feature ids. A write is one change that the daemon merges.
- **Release facts.** `GET /api/v1/server` returns `version` and `commit` to
  every signed-in person, not only administrators. `bundleRelease.ts` tells
  whether the tab runs the bundle the server now serves.
- **Conversation history.** The browser has the person's conversation list.
  That list cannot tell "first conversation ever": sessions started over SSH
  or by an agent are in it too. A browser-side "first time" therefore means a
  missing flag, not an empty history.

Per riff:

- **Pohja**: one new `localStorage` key (for example `nah:header-explained`).
  No contract or daemon change. Per device by construction, which causes
  both of its gaps.
- **1**: a new field in account preferences, for example
  `header_explained: ["editor", "terminal", …]`. The schema `result` and a
  `write` variant that adds ids would change, and the daemon would merge
  them. This is a field in the person's existing file, not a new store. The
  ids are stable header-action names. A button counts as explained only once
  a card has listed it as an icon. Being named in a ⋯ menu does not count,
  because the menu already gives the name. That rule is what makes "phone
  first, desktop later" show only the four one-offs.
  **The release version is not used.** A trigger keyed on `/api/v1/server`
  `version` would fire on every release, including the many that add no
  header button. Comparing the row's ids with the explained list fires
  exactly when something new is on the row. A per-device variant with the
  same list in `localStorage` would need no contract change. It would bring
  back Pohja's "whole card again on every new device", and on the phone→desktop
  path the remainder card would become the whole card.
- **2**: nothing stored. Only the tooltip text (`navigation.ts` catalogs)
  and a long-press handler on touch.
- **3**: a `header_used` id list, in `preferences.json` to follow the person
  or in `localStorage` per device. It needs the same contract change as riff 1
  if it lives on the account.

## Recommendation

**Riff 1 · Kerran tilille, uudet erikseen, with riff 2's meaning line in
the tooltip.**

- It is the only riff that explains each button exactly once to the person,
  wherever she first meets it. Pohja repeats the whole card on her phone and
  then stays silent when a release adds a button. With riff 1 the release
  case gets one small card at the new button. Without that, the round-1
  problem returns with every new icon.
- The trigger is a fact the browser already has, the ids on the row,
  compared with one list in the person's own preferences file. It needs no
  release bookkeeping, no new service and no host state beyond a field the
  daemon already merges.
- Pressing the button counts as learning it, so someone who explores is not
  told afterwards.
- The meaning line in the tooltip costs nothing and stores nothing. It helps
  the mouse user who hovers *after* pressing Selvä, which is the weak point of
  every card: people close it unread.

Riff 2 alone leaves a first-time phone user exactly where Kaisa was. Riff
3 explains only after the fact, but its Arkistoi confirmation is worth
considering on its own.

## Questions for Jari

1. Should the explained list live on the **account**
   (`preferences.json`, follows the person, needs a contract field) or **per
   device** (`localStorage`, no contract change, but the whole card again on
   each new browser)? I recommend the account.
2. Should the tooltip carry the meaning line as in riff 2 (*Pääte* followed
   by "Avaa komentorivin…"), or stay a bare name as `icon-tooltips-slow`
   makes it?
3. Riff 3's first-press Arkistoi explanation ("Siirtää valmiin keskustelun
   pois sivupalkista… Arkistoi / Peru") is independent of the card. Should it
   come along, or is Arkistoi's undo enough?

No production code was changed.
