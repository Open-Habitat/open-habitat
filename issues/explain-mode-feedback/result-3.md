# Explain mode feedback: prototype round 3

## Saatesanat

Kortti pysyy nyt kaikissa suunnissa kuten Kulkureitissä. Alarivillä on yksi
painike, Ilmoita virheestä, ja sen alla lukee "Selitys on väärin tai
puutteellinen". Auttoi-valintaa ei enää ole. Painike avaa kentän, johon on
pakko kirjoittaa: tyhjällä kentällä lähetyspainike vain pyytää kirjoittamaan,
mitä pitäisi korjata. Kokeile hiirellä: vie osoitin esimerkiksi
liitepainikkeen päälle ja siitä kortin alariville.

Suunnat eroavat siinä, miten kirjoitettu teksti pääsee meille. Alarivin
alla on yksi rivi, joka kertoo, minne teksti menee. A:ssa painat Avaa
GitHubissa, ja uuteen välilehteen avautuu valmis julkinen issue, jossa on
tekstisi ja kortin tunnus. Palvelimelle ei jää mitään. B:ssä ilmoitus jää
omalle tilillesi, ja palkki näyttää, montako lähettämätöntä on. Ne lähtevät
myöhemmin yhtenä GitHub-issuena. C:ssä yksi painallus lähettää tekstin
suoraan projektin palautelaatikkoon ilman tiliä, eikä ilmoitus ole
julkinen. Sellaista palvelua ei kuitenkaan vielä ole.

Suosittelen A:ta. Se on lyhin reitti, joka toimii jo nyt: kirjoitat, yksi
painallus ja GitHubissa Submit. Toteutettavaksi jää vain linkki, eikä
tarvita tallennusta, uutta sopimusoperaatiota eikä uutta palvelua.
Heikkous on GitHub-tili, mutta Open Habitatin käyttäjillä se on yleensä jo.
B lisää välivaiheen ja oman tallennuspaikan, joka jää tarpeettomaksi, kun
myönteiset palautteet jäävät pois. C on ihmiselle helpoin, mutta silloin
projektin pitää ylläpitää julkista vastaanottopalvelua roskapostisuojineen,
ja jokaisen palvelimen selaimen pitää saada ottaa siihen yhteys. Se on
arkkitehtuuripäätös, joten kysyn sitä alla erikseen.

## Built page

`design-system/prototypes/dist/explain-feedback-3/offline.html` (fonts
embedded) and `index.html` (without fonts), built with
`node design-system/prototypes/rounds/2026-11-21-explain-feedback-3/build.mjs`.
A copy that outlives the worktree:
`/var/tmp/agent-keep/explain-mode-feedback/round-3/offline.html`; the
check's screenshots are in
`/var/tmp/agent-keep/explain-mode-feedback/round-3/check/`. Sources, URL
parameters and commands are in the round's `NOTES.md`.

`check.mjs` passed 402 checks with a clean console. At 1440 px in Päivä and
Yö, in every direction, scripted mouse paths go in straight lines from the
context ring (card below) and from the attach button (card above, the path
crossing the message field) to "Report a mistake". The check reads the card
at every step and it never changes. With `?path=off` (production pointing)
the negative control loses the attach button's card to the message field.
The check also covers:

- an empty send asks for text and sends nothing;
- the preview holds the text, the card id and the version, and no
  conversation or workspace name;
- each route's done state;
- a neighbour still takes the card at once;
- an open note with text survives a click elsewhere;
- Esc cancels and a second Esc stops the mode;
- the three default views name three different destinations;
- there is no positive choice anywhere;
- B's sheet holds only unsent reports and marks them, and A and C keep no
  list;
- the keyboard path in all three directions (focus, F, Enter, type,
  Tab/Enter);
- at 390 px with touch, the tap path in Päivä and Yö;
- English and High contrast once.

The round directory holds no image or HTML file.

## Axis and directions

Axis: **how a written report reaches the developers.** The card holds as in
round 2's A Path. The footer has one control, "Report a mistake / The
explanation is wrong or incomplete" (or F), and it opens a required note
(600 characters).

| | A GitHub | B Own account | C Feedback inbox |
|---|---|---|---|
| Send control | **Open in GitHub ↗** (one press, then Submit in GitHub) | **Save**, later **Send now** / "Unsent · n" → one issue | **Send to the developers** (one press, done) |
| Needs | GitHub account; browser reaches github.com | Same at send time; nothing to save | Browser reaches the project's inbox; no account |
| Public | Text, card name and id, version, language as a public issue | The same, once sent | Nothing public; the project may later file a public issue without the name |
| Stored on the server | Nothing | The report, in the person's own account until sent or removed | Nothing |
| Administrator sees | Nothing | Nothing (per-user daemon, own home) | Nothing; the request leaves the person's browser, not the server |
| New to build | A link | Per-user store, contract op (round 1–2 design) | A project-run intake service with spam control; CSP `connect-src` for it |

Shared by all three: the card says what the route needs and what is
public, and "Show what is sent" displays the whole text. A click elsewhere
with typed text nudges instead of losing it, and an empty note closes.
After sending, the card says what happened: A "Opened in GitHub; sent when
you press Submit there", plus the no-account line and Copy text; B "Kept in
your account · Send now ›"; C "Sent; you get no reply". Returning to a card
in the same session says "You reported this card just now."

## Host facts the view assumes

- A: the browser knows the product version and the card ids and opens
  `https://github.com/Open-Habitat/open-habitat/issues/new?title=…&body=…&labels=explain-feedback`.
  No host change.
- B: unchanged from rounds 1–2. The per-user daemon keeps reports in the
  person's own account, and a contract operation adds, lists, deletes and
  marks one's own reports.
- C: a project-operated HTTPS endpoint, which does not exist. The browser
  posts the text, card id, version and language to it directly. No host
  component makes the call, and nothing about the server or the person is
  sent beyond what any web request reveals (the IP address).

## Decisions for later review

- **The note is required and has one label, "What should be fixed in the
  explanation".** The send button looks disabled while the note is empty
  but stays focusable, and pressing it says what is missing. Alternatives:
  a truly disabled button; two categories (wrong / missing). Why: a
  disabled button explains nothing, and Jari merged the categories. The
  text says which one it is.
- **The limit is 600 characters**, up from 280. Why: a required note should
  have room for a sentence about what is wrong and a correction. It also
  keeps A's prefilled URL far below GitHub's limits.
- **A's issue title names the card**: "Explanation wrong or incomplete:
  Context (Y05)". Why: the card id makes duplicates findable in GitHub
  search. Alternative: a title from the note's first words.
- **A keeps nothing on the server**, not even a copy for "Your reports".
  Why: only B needs the store, and keeping it in A would rebuild B.
- **C's request comes from the browser, not the host.** Alternative: the
  daemon or gateway posts it. Why: a host-side call would give a host
  component a new outbound flow, which needs an architecture decision.
  From the browser the administrator sees nothing and no authority moves.
  Either way C needs the project's own service.
- **The prefilled URL keeps `labels=explain-feedback`.** Round 2's caveat
  still applies: GitHub may ignore prefilled labels for people without
  triage rights, so an issue template is the reliable route.
- **The "Your reports" view stays in the review bar for A and C** and says
  there is no list. Why: so the difference between the directions can be
  seen.

## Questions for Jari

1. A, B or C? (Recommendation: A.)
2. If C is what you want ("very directly", no GitHub account): should the
   project run a public feedback intake, an architecture decision with its
   own issue, plus spam handling and a privacy note? Or should a person
   without a GitHub account stay at "Copy text"?
3. Is the public GitHub issue right for every report, or should explain
   feedback go to a Discussion category instead? A Discussion can also be
   prefilled by URL and keeps the issue tracker for accepted work.
4. Is 600 characters right, and is "What should be fixed in the
   explanation" the right single question?
