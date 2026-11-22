# Rail state change: prototype round

## Saatesanat

Tässä on kuusi tapaa nähdä, että keskustelun tila muuttui, kun luet toista
keskustelua. Mukana on tuotanto vertailuksi ja viisi suuntaa. Jokaisessa
suunnassa soi sama kahdeksan tapahtuman käsikirjoitus: vuoro päättyy
muualla, keskustelu käynnistyy, selain odottaa, keskustelu epäonnistuu,
yksi kysymys tulee näkymän ulkopuolella ja viisi muutosta tulee kerralla.
Seuraava tapahtuma -painike vie eteenpäin yksi kerrallaan, tai voit
antaa sen soida itsestään. Suosittelen E:tä. Siinä muuttunut rivi saa
merkin "uusi", joka pysyy, kunnes avaat keskustelun, ja yhden hehkun, joka
häipyy. Kun muutos on näkymän ulkopuolella, reunasiru kertoo "+n".
Silloin muutos löytyy myöhemminkin, eikä viisi yhtäaikaista muutosta
välky.

## Round

`design-system/prototypes/rounds/2026-11-22-rail-state-change/`. NOTES.md
describes it in full (in Finnish), together with the phone mapping.
Built page: `design-system/prototypes/dist/rail-state-change/offline.html`
(`index.html` without fonts), built by the round's `build.mjs`.

Axis: **the visual means of a state change, and how long it lasts.** The
same eight scripted events run in every direction, on the production rail
beside an open conversation:

| | Means | Lasts | Out of view | Five at once |
|---|---|---|---|---|
| Nyt | (production) section and mark change only | – | production chip counts rows | five rows jump |
| A Liuku | row slides to its place, background glows and fades | 3.5 s | nothing new | five slides and glows |
| B Merkki | edge bar, bold title, "uusi" in the time's place | until opened | nothing new | five calm marks |
| C Laskuri ja siru | section count pulses once, "+n" beside it | until opened | "+n" on the production edge chip | "+5" |
| D Reuna | rail edge glows twice, stays a thin line; Työtilat row "n uutta" | until opened | the edge is the whole rail | one glow |
| **E Yhdistelmä** | B's mark + one A glow (no slide) + C's chip + polite live announcement | mark until opened | "+n" on the edge chip | marks, no glow, one announcement |

A start (Käynnissä) is news but asks nothing of the person, so in every
direction it gets only the transient part (A's glow, C's pulse) and never
a persistent mark. A failure and the browser waiting are strong changes
like a turn ending. With reduced motion (the device setting or the panel's
switch) nothing moves: A's and E's glow is a still tint for 6 s, C's
pulse and D's glow are left out, and the marks are unchanged. No
direction relies on colour alone: the word "uusi", bold titles, "+n" and
"n uutta" carry the change.

## Recommendation

**E**, combining the persistent mark (B), the edge-chip count (C) and one
non-moving glow (A without the slide):

- The person usually notices the change later, not at the moment it
  happens, so something has to persist until they look. A glow alone (A)
  is gone in seconds, and a count alone (C) does not say which row.
- The glow catches the eye at the moment the change happens. The slide
  adds motion the eye has to follow and is the noisiest part when five
  change, so it is dropped.
- The production edge chips already name the sections out of view, and
  "+n" on them is the smallest way to tell of a change there. A separate
  "↑ 1 uusi" chip would compete with them for the same edge.
- D's edge glow tells *that* something changed but not *what*. It is the
  fallback for places without rows: the phone's closed drawer (the
  navigation button's badge) and the narrow rail. NOTES.md says how.

## What the host would need

Nothing new for replies. The host already knows a reply is unread
(`attention`) or read (`turnMark: "read"`), and E's mark for a reply is
exactly the unread state, drawn more visibly. A failure and the browser
waiting have no host "seen" fact; the mark for them would be browser-local
(this tab's memory of which changes the person has opened), which is
presentation state and needs no store. The trigger is the same as the
attention sound's (`railNow.ts` `readyKey`, `attentionSound.ts`'s settle
window), so the rows present at load or after a reconnect are not marked
as new.

## Evidence

- `check.mjs`: 265 checks green (every direction, Päivä and Yö, reduced
  motion for A and E, English, auto-play, picker, clean console).
- Screenshots (not committed): `/var/tmp/agent-keep/rail-state-change-visual/`,
  `d<n>-<step>-<theme>.png`.

## Decisions for later review

- **"Looked at" means opened.** Alternatives: hovering or focusing the row
  for a moment, or the row having been in view. Hovering is accidental and
  a row in view is not a conversation read, and opening matches the
  production unread/read reply.
- **A start gets no persistent mark.** Alternative: mark every change.
  Käynnissä changes often and asks nothing, and marking it would wear out
  the mark.
- **The failure and the browser wait stay in Käynnissä.** This is
  production's placement (railNow: a crash or cut turn stays in Käynnissä;
  the browser asks mid-turn). The round marks them in place rather than
  moving them.
- **Three or more changes in one event is a burst** (E: no glow, one
  announcement). Alternatives: two, or a time window. Three is the smallest
  number at which simultaneous glows read as flicker in the round.
- **The out-of-view sign decorates production's edge chip** instead of
  adding a separate "↑ 1 uusi" chip (the brief's example).
- **Only a desktop page.** The phone's drawer and badge mapping is written
  in NOTES.md rather than built.

## Questions for Jari

1. Is E right, or do you want A's slide too, so you can see a row *move*
   into Sinun vuorosi?
2. Should the mark go only when you open the conversation, or also when you
   hover over the row?
3. Should a conversation that starts running (Käynnissä) get any sign that
   lasts, or is the brief glow enough?
4. On the phone, is a ring on the navigation button's count enough to tell
   "something new" from "something waiting"?
