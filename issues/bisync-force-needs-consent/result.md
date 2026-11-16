# Sync stop and consent: the card, round 3 (16.11.2026)

> **Saatesanat.** Valitsit kierroksella 2 suunnan A Kortti: Habitatin oma
> kortti tulee keskusteluun sen vuoron jälkeen, jonka muutokset pysäyttivät
> synkronoinnin, ja lupa annetaan vain kortin painikkeella. Tämä kierros
> tekee kortista niin konkreettisen, että sen voi kirjoittaa speksiksi.
> Kortista on kolme muotoa, ja suosittelen muotoa **B Valmiina**: kortti
> tulee valmiin laskelman kanssa ja sanoo heti, poistaako jatkaminen
> jotain. Painike sanoo, mitä tapahtuu, esimerkiksi "Vie 16 tiedostoa
> OneDriveen". Samalla sivulla näkyvät agentin tuoma kortti, liikaa poistoja
> -pysähdys ja kysymys 4 esimerkin kanssa. Kysymys 4 on selitetty alla
> tavallisella suomella omassa kohdassaan.
> Sinulta kysytään neljä asiaa (kohta "Questions for Jari"): kortin muoto,
> valintaruudun paikka, saako Habitat liittää pysähdyksen keskusteluun
> pelkän komentorivikomennon perusteella, ja kierroksen 2 avoin kysymys 4.
> Jokaisessa on suositus. Viimeinen kohta erottelee, mitä olet päättänyt
> ja mikä on ehdotusta.

## What Jari has decided

- Sync stops and does not continue by itself. The person sees why and
  what continuing would do, and gives a separate consent to one forced
  pass. (14.11.)
- The stop belongs in the conversation where the agent caused the change,
  not in Settings. (14.11., on round 1.)
- On round 2 (16.11.): direction **A Kortti**. Consent is only ever the
  card's button, bound to the count. There is no separate agent dialog:
  the agent may bring the same card into the conversation with a command
  (proposed name `open-habitat agent sync request-consent`) after
  explaining in its own words, but it never consents, and a "yes" typed to
  the agent is not consent. When no conversation caused the stop, the bell
  and the Settings card are enough. The "too many deletions" stop gets the
  same card and consent. Question 4 stays open and is explained here.

## Round 3: three forms of the card

Round: `design-system/prototypes/rounds/2026-11-16-sync-consent-3/`. Its
`NOTES.md` says how to build and check it and what the host would have to
provide. Built page: `design-system/prototypes/dist/sync-consent-3/offline.html`.

The axis is how the card gets from the stop to the consent. The content,
the stop kinds and who brings the card are the same in all three.

- **A Pyynnöstä** (on request). The card says that sync stopped, why, and
  which edits caused it. *Katso, mitä jatkaminen tekisi* makes the count
  and fills it into the card with a table, and *Jatka kerran* consents.
  When it is done, the card folds to one receipt line with *Näytä*, which
  opens the table again. After *Älä jatka* the card stays open, because
  sync is still stopped.
- **B Valmiina** (ready). The card arrives with the count already made at
  the moment of the stop. It gives one sentence ("Jatkaminen vie
  OneDriveen 14 muuttunutta ja 2 uutta tiedostoa. Mitään ei poisteta.")
  and a button that names the action ("Vie 16 tiedostoa OneDriveen"). The
  table is behind *Näytä erittely*. If the files changed after the count,
  Habitat does nothing and shows the new count and button in the same
  card. Done and cancelled both fold to one line.
- **C Nimeltä** (by name). Count on request, as in A, but the card lists
  the files by name in groups (deletions first, five per group, the rest
  on request). The done receipt opens the file list.

**Recommendation: B.** It puts the deciding fact, whether anything gets
deleted, in front of the person without a press, and consent is one press
whose label says what happens. Counting at the stop costs nothing in
safety, because Habitat counts again at the moment of consent and refuses
if anything changed, so a stale count cannot let anything through. A's
extra press buys no safety. C's names help recognise the edits in the
small case, but with 212 moved files the card becomes a list to scroll,
not help to decide. If names are wanted, they fit inside B's *Näytä
erittely*. One cost of B: the dry run is made at every stop even if
nobody looks. Stops are rare and a dry run only lists both sides.

## The agent brings the card

Shown in every direction with *Kortin tuo: Agentti komennolla* or preset 2.
The person asks in the conversation whether the bell's stop was caused by
the agent's work. The agent runs `open-habitat agent sync status`, explains
in its own words what it did, and runs `open-habitat agent sync
request-consent onedrive --current`. The same card then appears under its
reply, marked *agentin pyynnöstä*. Because the agent brought it, the card
does not claim the cause itself ("synkronointi pysähtyi, koska kaikki
kansion tiedostot muuttuivat kerralla") and leaves the explanation to the
agent above it.

With *Agentti, ihminen vastasi kyllä*, the person types "Kyllä, jatka
vaan." The agent answers that a message is not consent, runs the command
again, and the card moves under that reply. There is only ever one card
per stop.

`--current` identifies the conversation the same way as the existing
`open-habitat agent conversation show --current`, through the context the
daemon gives the Pi it launches. No authority moves.

## The "too many deletions" stop

Shown with *Pysähdys: Liikaa poistoja* or preset 3. An agent moved 212 of
240 reports to an archive folder. OneDrive sees the move as 212 deletions
and 212 new files, more than half, so sync stops on its deletion guard
before anything else. The card is the same. The differences:

- The lead already names the number: "Synkronointi pysähtyi, koska tämän
  keskustelun muutosten jälkeen se olisi poistanut OneDrivesta 212
  tiedostoa 240:stä."
- The count carries a strong warning that explains the move, the checkbox
  *Poistot ovat tarkoituksellisia*, and a danger button *Poista 212 ja
  jatka* that stays disabled until the box is ticked.

A third case, *Kaikki muuttuivat, 3 poistoa*, shows an ordinary
all-files-changed stop with a few deletions. The deletions are named in a
line and in the button ("Poista 3 ja jatka"), without the checkbox.

## Kysymys 4 selkokielellä

Kun painat kortin painiketta, Habitat tekee kaksi asiaa peräkkäin:

1. Se tarkistaa, onko laskelma yhä totta: muuttuiko jokin sen jälkeen,
   kun luit kortin. Jos muuttui, mitään ei tehdä ja saat uuden laskelman.
2. Se ajaa yhden pakotetun synkronoinnin.

Näiden kahden välissä on muutama sekunti. Jos joku poistaa juuri silloin
OneDrivesta tiedostoja, vaikkapa toisella laitteella tai vahingossa
OneDriven selainkäytössä, tarkistus ei ehdi nähdä sitä. Pakotettu ajo
ohittaa synkronoinnin omat turvarajat, joten poistot tulisivat sen mukana
Habitatiin, vaikka kortti lupasi "Mitään ei poisteta". Tätä ei ole
koskaan havaittu, mutta se on mahdollista.

**Suositus:** kun laskelmassa ei ollut yhtään poistoa, pakotettu ajo
tehdään tilassa, jossa se ei voi poistaa mitään. Olet hyväksynyt ajon,
joka ei poista, joten se ei myöskään voi poistaa. Jos joku poisti jotain
sillä välin, poisto odottaa seuraavaa tavallista synkronointia. Se on
tavallinen ajo turvarajoineen: pieni poisto menee läpi kuten aina, ja suuri
pysäyttää synkronoinnin uudelleen ja kysyy erikseen.

Mitä näet eri tavalla:

- Tavallisesti melkein ei mitään. Kortin lause muuttuu lupaukseksi:
  "Mitään ei poisteta: tämä ajo ei voi poistaa tiedostoja." Käynnissä
  oleva ajo sanoo saman.
- Harvinaisessa tapauksessa (preset 4, tai simulaatio "pilvessä
  poistetaan 150 juuri ennen ajoa") ero on suuri. Suojan kanssa kuittaus
  kertoo, että 150 poistoa jäi odottamaan, ja kello näyttää uuden
  pysähdyksen "olisi poistanut Habitatista 150 tiedostoa 240:stä". Ilman
  suojaa kuittaus kertoo punaisella, että ajo poisti Habitatista 150
  tiedostoa, joita lupasi ei koskenut.

Suoja ei auta, kun laskelmassa oli poistoja (esimerkiksi siirron 212
poistoa), koska silloin ajon on saatava poistaa. Siinä tapauksessa
muutaman sekunnin ikkuna jää, ja kortti kertoo rehellisesti, jos ajo
poisti enemmän kuin laskelma sanoi. Toteutustapa on vielä tarkistamatta
oikealla rclonella. `NOTES.md` kertoo kaksi vaihtoehtoa.

## States the card goes through

Same in all directions, unchanged from round 2 except where noted: stopped,
counting, counted, running, done (folded receipt), cancelled (A and C stay
open, B folds), refused because the files changed after the count (B
recounts and asks again in place), failed, another conversation open (bell
and rail mark open the right conversation), and no conversation behind the
stop (the bell opens the same card in a dialog, and the Settings card
shows the same notice).

## Decisions for later review

Made in this round by best judgement (16.11.2026):

- **Axis: how the card leads to consent.** Alternatives: card size or tone
  only, or where the count shows (inline or dialog). Why: whether the
  count is fetched automatically, how much it lists and how the card
  folds are the open choices that change what the person does. Placement
  was decided.
- **Habitat's own card names the cause, the agent-brought card does
  not.** Alternative: the same lead in both. Why: the agent brings the
  card mainly when Habitat could not tie the stop to the conversation with
  certainty, so Habitat should not claim a cause it did not establish. The
  agent's own explanation sits right above.
- ***Kysy agentilta* only on Habitat's own card.** When the agent brought
  the card, the agent has already explained.
- **One card per stop.** It moves under the latest `request-consent`.
  Alternative: a new card each time. Why: two consent buttons for one stop
  would make it unclear which one counts.
- **The checkbox only for the too-many-deletions stop.** A few deletions in
  an all-files-changed stop are named in the sentence and the button.
  Alternative: round 2's checkbox for any deletion. Why: a checkbox for
  three deliberate deletions trains people to tick it without reading.
  This is question 2.
- **The too-many-deletions card states the number at the stop.** This
  assumes rclone's abort reports the counts. Not verified; otherwise the
  lead says "more than half" and the count gives the number.
- **The command takes `--current` and prints the CLI's JSON envelope**,
  following `open-habitat agent conversation show --current` and the
  AI-first CLI canon. A companion `open-habitat agent sync status` lets the
  agent see the stop without the browser.
- **The fallback's dialog shows the same card body** as the conversation,
  so there is one card design, not two.
- **B's cancelled card folds to one line** with *Näytä laskelma*, because
  B's count is ready anyway. A and C stay open.

## Live check

Nothing on the test server; this is an offline prototype. Build with the
command in the round's `NOTES.md` and open `offline.html`. The four *Näytä*
buttons at the top lead to the four things shown: Habitat's card, the
agent bringing it, too many deletions, and question 4. Switch the picker
at the bottom between A, B and C in each. For question 4, press preset 4,
then switch *Kysymys 4* to *Ajo voi poistaa* and compare the receipt and
the bell.

## Questions for Jari

1. **Which form of the card: A, B or C?** Recommendation: B. The count is
   in the card from the start and the button says what happens. It is no
   less safe, because Habitat counts again at the moment of consent.
2. **Should only the "too many deletions" stop require the checkbox, with
   a few deletions only named in the sentence and the button?**
   Recommendation: yes. Round 2 required the checkbox for any deletion.
3. **When a stop is explained only by a shell command (the `mv` of 212
   reports), should Habitat still put its own card in that conversation?**
   Round 2's rule says no, because a shell command can write anywhere and
   a card in the wrong conversation names a wrong cause. Then the bell and
   Settings would show the move case, and the agent would bring the card
   when asked. Recommendation: keep round 2's rule, because the agent's
   command now covers this case. The prototype shows Habitat's card for
   the move case too, so that all combinations can be compared.
4. **Question 4 (open since round 2): when the count had no deletions,
   may the forced pass run in a mode that cannot delete anything?**
   Recommendation: yes, provided the implementation finds a way to do it
   with rclone (to be tested first). Any deletion made in the window then goes to the next normal
   sync, which stops again if it is large. For counts that did include
   deletions, the few-second window remains, and the receipt reports what
   was actually deleted.

## Erottelu

Lähteet: tämän issuen Decisions-merkinnät (14.11. 11:42Z ja 12:54Z,
16.11. 05:50Z), kierrosten 1–3 `NOTES.md` ja nykyinen koodi
(`internal/daemon/integrations/passes_linux.go`, `skill_linux.go`,
`internal/cli/agent_linux.go`).

**Jarin päättämää**

- Synkronointi pysähtyy eikä jatka itse. Ihminen näkee syyn ja sen, mitä
  jatkaminen tekisi, ja antaa erillisen luvan yhteen ajoon. (14.11.)
- Paikka on keskustelu, jossa agentti aiheutti muutoksen. (14.11.)
- Suunta A Kortti: Habitatin oma kortti heti aiheuttaneen vuoron jälkeen.
  (16.11.)
- Lupa on vain kortin painike ja sidottu laskelmaan. Erillistä
  agenttidialogia ei ole. Agentti saa tuoda kortin komennolla ja selittää
  omin sanoin, mutta ei anna lupaa, eikä agentille kirjoitettu "kyllä" ole
  lupa. Komennon nimi `open-habitat agent sync request-consent` on Jarin
  ehdotus, ei lopullinen. (16.11.)
- Kun mikään keskustelu ei aiheuttanut pysähdystä, kello ja Asetusten
  kortti riittävät, ei etusivun ilmoitusta. (16.11.)
- Liikaa poistoja -pysähdys saa saman kortin ja luvan. (16.11.)

**Ehdotusta** (kukaan ei ole päättänyt näitä)

- Kortin muoto (A, B tai C) ja kaikki sen yksityiskohdat: tekstit, painikkeiden
  nimet, taittuminen kuittausriviksi, *Kysy agentilta*.
- Laskelma pysähdyshetkellä (B) tai pyynnöstä (A, C). Uudelleenlaskenta
  luvan hetkellä ja torjunta, jos jokin muuttui. Kierroksen 1 sitominen on
  yhä ehdotus.
- Varoitus ja valintaruutu vain liikaa poistoja -pysähdyksessä (kysymys 2).
- Kysymys 4:n ajo, joka ei voi poistaa, ja sen toteutustapa.
- Yksi kortti pysähdystä kohden, ja kortin siirtyminen uusimman pyynnön
  alle.
- Komennon muoto: `--current`, JSON-tuloste ja rinnakkainen `status`.
- Milloin Habitat liittää pysähdyksen keskusteluun itse (kysymys 3 ja
  kierroksen 2 sääntö).
- Varapaikan ikkuna, jossa on sama kortti.
- Ehdotus agentin ohjeen lisäyksestä (`skill_linux.go`): selitys kuuluu
  agentille ja lupa kortille.

**Ristiriidat aiemman tekstin kanssa**

- `item.md`:n Direction-kappale mainitsee yhä "e.g. *Jatka silti* in the
  account's card, or asking the agent". Myöhemmät päätökset (12:54Z ja
  16.11.) korvasivat molemmat: paikka on keskustelun kortti, ja agentilta
  pyytäminen tarkoittaa vain, että agentti tuo kortin. Kappaletta ei
  muutettu tässä ajossa.
- Kierroksen 2 suositus perusteli A:ta sillä, että laskelma tehdään
  pyynnöstä, jotta se on tuore. Tämän kierroksen suositus B laskee heti ja
  luottaa uudelleenlaskentaan luvan hetkellä. Molemmat ovat ehdotuksia.
