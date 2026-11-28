# Multiplayer: inventory of prototypes and round Moninpeli 1

## Lyhyesti Jarille

Vanhat 21.11. kierrokset (omistaja, osallistuja, oikeuksien ja prosessien
takaisinotto) rakentuvat ja läpäisevät yhä tarkistuksensa, mutta ne kuvaavat
kokeellista moninpeliä: kutsu mihin tahansa keskusteluun, omistajan oma malli,
"luotettu" ja vuorokohtaiset tilamerkit. Asetuksia (API-avainvaatimus),
aloitusta Moninpeli +:lla ja suurinta osaa kulmatapauksista ei ollut missään.
Uusi kierros `design-system/prototypes/rounds/2026-11-28-moninpeli-1/`
näyttää kaikki viisi aluetta uuden suunnan mukaan yhdellä sivulla
(Näkymä-valinta), ja kolme suuntaa eroavat vain siinä, missä Moninpeli + on.
Lopussa on kierroksen päätökset ja kolme kysymystä.

Sources: this issue's Direction; `design-system/prototypes/rounds/2026-11-21-*`
NOTES and code; `issues/multiplayer-browser/result.md` (what shipped);
`issues/unusually-wary-care/item.md`; `web/src/app/MultiplayerOwner.tsx`,
`web/src/app/SharedConversation.tsx`, `web/src/components/Multiplayer.tsx`,
`web/src/text/multiplayer.ts`, `internal/daemon/membership_linux.go`.

## Inventory

Every round was built with its own `build.mjs` and run through its own
`check.mjs --quick` on 28.11.2026 against the current `web/` code.

| Round | Builds / check | Areas it shows |
|---|---|---|
| `2026-11-21-multiplayer-owner` | yes / 206 checks pass | owner's view |
| `2026-11-21-multiplayer-guest` | yes / 170 checks pass | participant's view |
| `2026-11-21-take-back-rights` | yes / 228 checks pass | owner corner: taking full rights back |
| `2026-11-21-take-back-processes` | yes / 194 checks pass | owner corner: participant's processes after take-back |
| `2026-10-24-ai-avain-liittyneille` | not rerun | site AI key for people who joined earlier (admin side of keys, not multiplayer) |
| `2026-11-08/09-jaetut*` | not rerun | shared views and files, not multiplayer conversations |

All four 21.11. rounds pin the light theme instead of `initialTheme()`, so
they do not open in Habitat's theme; that is the only build-level drift.

### 1 Configuration (owner/admin, API-key requirement)

- **Shown before:** nothing. The experimental switch `multiplayer` in
  Kokeelliset is the only "configuration" in production. The site-key round
  shows how an administrator hands a site key to people, not whether
  multiplayer may use it.
- **Gap:** where the person sees that multiplayer needs an API key, which key
  and model it uses, what happens without one, and whether the administrator
  allows the server's key for multiplayer.

### 2 Starting (the Moninpeli + button)

- **Shown before:** only "Kutsu" in the people row of any conversation (owner
  round, shipped). That is exactly the plain invite the issue removes.
- **Mismatch:** the issue wants a deliberate start, its own kind of
  conversation, an API-key model chosen at start, and converting an ordinary
  conversation only through the same button with the model move.
- **Gap:** the button's place and look, the start dialog, the convert dialog,
  the no-key state, how a multiplayer conversation is recognisable in the
  rail and header.

### 3 Owner's view

- **Shown before:** owner round, three directions; 3 Kortti chosen and
  shipped (card where the agent stopped, Salli kaikki / Hyväksy yksitellen /
  Älä salli, people row and panel, Kutsu).
- **Still fits:** the card, people row, panel, Habitat lines and attribution;
  the issue keeps them.
- **Mismatch:** "Luotettu" in the round became "Täydet oikeudet" in
  production; the round's per-reply mode marks and the band showing "Vain
  teksti / Työkalut käytössä" talk about turn modes in the conversation, which
  the issue says the person should not have to understand; nothing marks the
  conversation as multiplayer or shows its model.

### 4 Participant's view

- **Shown before:** guest round; 1 Kaista (the strip) shipped, with the
  invite under Jaettu kanssasi and Liity / Ei nyt.
- **Still fits:** invite page, strip, attribution, unavailable page.
- **Mismatch:** the invite text and strip say the agent uses "the inviter's
  model, quota and connections" and talk about turn modes; the issue wants no
  talk of subscriptions, keys or automatic turns in the conversation.

### 5 Corner cases

| Case | Before | Gap |
|---|---|---|
| Participant removed while their request waits (`unusually-wary-care`) | take-back round assumes the request survives; daemon drops it once the membership entry is pruned | not prototyped from either side |
| Owner offline | nowhere | what the participant is told; that the agent still answers |
| Model key missing / stops working | nowhere | what the owner and participant see; that it never falls back to a subscription |
| Many participants | nowhere (rounds have 2–3 people) | band overflow, panel length |
| Archived | production says "not available" generically; take-back issue notes archived conversations cannot be opened by others | owner's archived state, what the participant sees, what happens to a waiting request |
| Phone | every round checks 390 px | — (covered) |
| Taking full rights back, participant's processes | take-back rounds, shipped | still fits |

## Round Moninpeli 1

`design-system/prototypes/rounds/2026-11-28-moninpeli-1/` (build and check
commands in its `NOTES.md`; `dist/` is untracked). One page, a **Näkymä**
selector for the five areas, a **Tapaus** and **Kenen silmin** selector for
the corner cases, an **AI-avain** selector (own / server / none) for
configuration and starting.

**Axis: where Moninpeli + sits and how it looks.**

- **1 Nimetty painike**: a labelled "+ Moninpeli" beside "Uusi keskustelu" in
  the workspace head; the same labelled button in an ordinary conversation's
  header.
- **2 Ikoni rivissä**: a people-plus icon right after production's "+" in the
  workspace icon row; the same icon in the conversation header (named for
  assistive tech and in its tooltip).
- **3 Tyhjässä**: no separate button on the workspace page; "Uusi
  keskustelu" opens an empty conversation that first asks Tavallinen or
  Moninpeli; the header button converts later.

Reused from the 21.11. rounds and production: the card, people row and
panel, the participant's strip, invite page and unavailable page, the
attribution and Habitat lines, avatars and colours, all from the shipped
components. New: the button, start and convert dialogs, the Moninpeli
settings rows and the admin permission, the multiplayer mark (header chip,
rail glyph), and the corner-case states.

Host facts the view assumes: the daemon knows which model routes are API-key
routes (own key or server key) and which are subscriptions, and refuses a
subscription route for a multiplayer conversation; a conversation carries
"multiplayer" as a durable fact the rail can read; the daemon tells the owner
when the multiplayer key fails and holds messages until it works; a waiting
request survives the requester's removal and archiving.

Checked with `check.mjs`: three directions at 1440 and 390 px in Päivä and
Yö (owner's view also in Kontrasti), every flow clicked, adjacency of the
button to Uusi keskustelu (and of the kind choices and invite buttons), no
horizontal overflow, clean console: 1168 checks pass.

### Päätökset myöhempää katselmointia varten

1. **Ilman avainta Moninpeli + näkyy ja toimii**: painallus avaa ikkunan,
   joka kertoo syyn ja vie AI-asetuksiin. Himmennetty painike ei kertoisi
   syytä puhelimessa, jossa vihjettä ei ole.
2. **Ylläpitäjä sallii palvelimen avaimen moninpeleihin erikseen**, ja
   luvan poisto pysäyttää sitä käyttävät moninpelit, kunnes omistaja valitsee
   toisen avaimen. Palvelimen avain ei siis automaattisesti maksa kaikkien
   moninpelejä.
3. **Moninpelistä ei palata tavalliseksi keskusteluksi**; muunnosikkuna
   sanoo sen. Paluu toisi rajan takaisin keskelle keskustelua.
4. **Poistetun osallistujan odottava pyyntö jää omistajalle** (kortti
   kertoo, ettei hän ole enää mukana), ja osallistuja näkee, että hänet
   poistettiin ja pyynnöt jäivät omistajalle. Tämä on `unusually-wary-care`:n
   ensimmäinen vaihtoehto; daemon pudottaa pyynnön nyt.
5. **Avaimen pettäessä viestit odottavat**, omistaja näkee syyn ja
   "Valitse malli" -toiminnon kentän yllä, osallistuja vain "Agentti ei voi
   vastata juuri nyt". Moninpeli ei koskaan siirry tilaukseen.
6. **Arkistoitu moninpeli** katoaa osallistujilta (he näkevät syyn, jos
   avaavat sen), odottava pyyntö säilyy mutta ei ole ratkaistavissa ennen
   palautusta.
7. **Puhelimessa otsikon merkki on pelkkä kuvake**; sana jää
   ruudunlukijalle.
8. **Osallistujan nauha ja kutsu eivät enää puhu mallista, kiintiöstä eikä
   vuorotiloista**: "Agentti vastaa sinulle tekstillä. Työkaluja vaativat
   toimet odottavat, kunnes Aino sallii ne."

### Kysymykset Jarille

1. Mikä suunta: 1 Nimetty painike, 2 Ikoni rivissä vai 3 Tyhjässä? Suositus
   on 1: se on ainoa, jossa moninpelin aloitus näkyy sanana samassa paikassa
   kuin tavallinen aloitus, mikä tekee rajasta selvän.
2. Saako palvelimen avainta käyttää moninpeleihin vain ylläpitäjän luvalla
   (päätös 2), vai aina kun palvelimella on avain?
3. Hyväksytkö, että poistetun osallistujan odottava pyyntö jää omistajan
   ratkaistavaksi (päätös 4)? Se ratkaisee `unusually-wary-care`:n.
