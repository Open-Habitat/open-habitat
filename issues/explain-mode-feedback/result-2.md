# Explain mode feedback: prototype round 2

## Saatesanat

Tätä kierrosta kannattaa kokeilla hiirellä. Selitystila toimii sivulla
kuten tuotannossa: kortti seuraa osoitinta, ja tyhjän kohdan päällä viimeisin
kortti jää näkyviin himmeämpänä. Kokeilin, miten kortin alariville pääsee
ilman, että kortti vaihtuu matkalla. Vaikein kohta on liitepainike: sen
kortti on yläpuolella viestikentän päällä, joten matkalla korttiin osoitin
kulkee viestikentän yli. Tuotannossa kortti vaihtuu silloin viestikentän
korttiin, ja tarkistus osoittaa tämän B:n nastattomalla kortilla.

A:ssa kortti pysyy, kun osoitin kulkee kohdasta suoraan kortille. Muualta
tultaessa kortti päästää osoittimen läpi kuten nyt, ja viereinen kohta vaihtaa
kortin heti. B:ssä kortti on täsmälleen tuotannon kaltainen, ja sen reunalla
on pieni nasta. Nastaa painamalla kortti pysähtyy, ja vasta silloin
palautevalinnat tulevat näkyviin. C:ssä valinnat tulevat esiin, kun osoitin
on ollut hetken paikallaan, ja ohi kulkeminen ei sen jälkeen vaihda korttia.

Suosittelen A:ta. Siinä palaute on yksi liike ja yksi painallus, valinnat
näkyvät aina, ja selaaminen tuntuu samalta kuin nyt. B vaatii ylimääräisen
painalluksen pieneen kohteeseen, ja palaute jää piiloon, kunnes nastan
löytää. C:ssä joutuu odottamaan, ja asettumisen jälkeen kortin vaihtuminen
viivästyy.

Lähettäminen on nyt yksi askel. Tallennuksen jälkeen kortissa lukee "Kiitos
· Lähetä kehittäjille ›". Se avaa valmiin GitHub-issuen koko tekstin ja
painikkeen Avaa GitHubissa. Issue lähtee vasta, kun painat GitHubissa
Submit. Samassa ikkunassa kerrotaan, mitä tapahtuu ilman GitHub-tiliä:
GitHub pyytää kirjautumaan tai luomaan tilin, ja tekstin voi myös kopioida.
Ylläpitäjä ei näe palautetta missään vaiheessa.

## Built page

`design-system/prototypes/dist/explain-feedback-2/offline.html` (fonts
embedded) and `index.html` (without fonts), built with
`node design-system/prototypes/rounds/2026-11-21-explain-feedback-2/build.mjs`.
A copy that outlives the worktree:
`/var/tmp/agent-keep/explain-mode-feedback/round-2/offline.html`; the
check's screenshots are in
`/var/tmp/agent-keep/explain-mode-feedback/round-2/check/`. Sources, URL
parameters and commands are in the round's `NOTES.md`.

`check.mjs` passed 282 checks with a clean console. At 1440 px in Päivä and
Yö, scripted mouse paths go in straight lines from the context ring (card
below) and from the attach button (card above, path crossing the message
field) to the footer's "Something missing". The card is sampled at every
step and never changes in any direction. The negative control shows that
B's unpinned card, which behaves like production, loses the same path to
the message field. Further checks: A still switches to a neighbour at once;
a settled C card ignores a quick pass and gives way after a rest; an open
note with text survives a click elsewhere; Esc cancels and a second Esc
stops the mode; the keyboard path works (focus, F, Tab/Enter, the thanks
link, Esc closing the sheet). At 390 px with touch, tap paths are checked
in Päivä and Yö. Sending is checked in every pass, plus English and High
contrast once. The round directory holds no image or HTML file.

## Axis and directions

Axis: **how the hover card stays put so its footer can be reached.**
Same cards (production texts), same three choices and note as round 1.

- **A Path.** The footer is always on the card. The card takes the pointer
  only when the pointer comes from its own part: the band from the part's
  facing edge to the card's facing edge keeps the card, even over other
  parts. Arriving from anywhere else, the card lets the pointer through as
  in production. Decides: one motion, no waiting, browsing unchanged; a
  part inside that narrow band is reached by leaving the band first.
- **B Pin.** The card is production's (`pointer-events: none`). A small pin
  sits on the edge facing the part, under the pointer's x, reaching into the
  gap. Pressing it stops the card and shows the footer; pressing again
  releases it. On a phone it is a "Give feedback" button. Decides: browsing
  is exactly production; feedback costs an extra press on a 26 px target and
  is invisible until then.
- **C Settle.** After 0.6 s with the pointer still on the part, a thin line
  fills and the card settles: choices fade in and the card takes the
  pointer. A settled card changes only when the pointer rests 0.25 s on
  another part. On a phone the choices show at once. Decides: no footer
  noise while scanning; feedback waits for a pause, and after a pause the
  next card comes a little later.

Shared by all three: Wrong / Something missing opens the note, moves focus
into it and holds the card until Save or Cancel. A click elsewhere with
typed text nudges instead of losing it, and an empty note closes. Esc
cancels the feedback first and stops the mode second. A focused part
explains itself, and F moves focus into the footer. After saving, the card
says "Thanks, kept in your own account. Send to the developers ›". The
bar's "Your feedback · n" opens the list.

## Sending

One step from "Your feedback" or the card: a sheet with the whole prefilled
issue (title, one line per unsent item with card name, id, choice and note,
then version and language), the line saying it is public and what it does
not contain, **Open in GitHub** (primary), Copy text, Cancel, the address
it opens (`https://github.com/Open-Habitat/open-habitat/issues/new?title=…&body=…`)
and "No GitHub account?". Opening marks the items "Opened in GitHub". The
prototype does not navigate.

## Host facts the view assumes

Unchanged from round 1: feedback is kept by the per-user daemon in the
person's own account, with a contract operation to add, list, delete and
mark one's own feedback. Nothing about other users is involved. Nothing
leaves the server except when the person opens the prefilled issue in their
own browser. The browser knows the product version and the card ids.

## Decisions for later review

- **A's band is the hull of the facing edges, plus 4 px.** Alternatives: a
  time-based grace (any pointer move within N ms keeps the card); a
  safe-triangle from the pointer's position (menu-style). Why: the band
  needs no timer, so browsing keeps production's speed, and it covers the
  hard case where the gap lies over another part.
- **A's card takes the pointer only when approached from its part, or just
  after saving.** Alternative: always (round 1). Why: an always-solid card
  hides the parts under it from pointing; arriving from elsewhere should
  behave as now.
- **A card placed above its part hangs from its bottom edge.** Why: the
  note opening in it would otherwise push the card off screen. Production
  places by top edge; this matters only once the card can grow.
- **A click elsewhere does not discard typed text.** Alternatives: discard;
  keep as a draft. Why: losing words to a stray click is the worst outcome,
  and a draft store adds state for a rare case.
- **Choosing Wrong / Something missing focuses the note.** Why: the next
  thing to do is type, and the keyboard path then needs no extra Tab.
- **F gives feedback on the showing card**, and a focused part explains
  itself. Alternatives: no keyboard path; Tab into the card. Why: production
  has no keyboard way to a card at all, and F does not collide with typing
  because it is ignored in fields.
- **Sending sends all unsent items as one issue.** Alternatives: one issue
  per card; choose items. Why: one step and one issue is the fastest; the
  list can still remove items before sending.
- **The prefilled URL carries `labels=explain-feedback`.** To verify before
  implementation: GitHub may apply prefilled labels only for people with
  triage rights, in which case an issue template carrying the label is the
  reliable route. Very long feedback lists can exceed URL limits; the
  implementation should split or trim.
- **"Opened in GitHub", not "Sent".** Why: the host cannot know whether the
  person pressed Submit.
- **The bar gets "Your feedback · n" once feedback exists.** Alternative:
  only the thanks link and Settings. Why: the list is one press away while
  the mode is on, without adding anything before the first feedback.

## Questions for Jari

1. A, B or C? (Recommendation: A.) Try A with the attach button: point at
   it, then move up to the card's footer.
2. Should explain mode explain the focused part, so that a keyboard user
   gets cards at all? Production does not yet; the prototype assumes yes.
3. One issue for all unsent feedback, or one issue per card? (The prototype
   sends all as one.)
4. Is "Your feedback · n" in the explain bar right, or should the list live
   in Settings as well?
