# Workerin näkymä · Kierros 2

Pohjana on ensimmäisen kierroksen **Kehys**. Worker avautuu pääkeskustelun
paikalle, ja yläreunan worker-kaista näyttää pääkeskustelun linkkinä,
issuen ja agentin. Workereita ei sisennetä sivupalkkiin. Pääkeskustelun
rivillä näkyy sama haaramerkki kuin tuotannossa silloin, kun sen worker
työskentelee.

Kierros vastaa kahteen kysymykseen:

- **(a) Claude Code -worker ennen kuin sen historiaa voi lukea.** Miten näkymä
  kertoo, että siitä näkyy toistaiseksi vain pääte, ja mitä tapahtuu, kun
  historia tulee luettavaksi.
- **(b) Kirjoituskentän puuttuminen.** Ilmoitus kertoo, ettei workerille
  kirjoiteta, mutta pääagentti voi viestiä sille, joten kysymys esitetään
  pääkeskustelussa. Ilmoituksesta pääsee pääkeskusteluun.

Valmistelussa selvisi kaksi asiaa, jotka muuttavat ilmoituksen sisältöä:

- **Pääagentti voi viestiä vain käynnissä olevalle Pi-workerille.**
  `taskfleet run message` toimii vain Taskfleetin käynnistämälle Pi-workerille,
  jolla on viestisovitin, eikä hyväksytty viesti vielä todista, että worker on
  lukenut sen. Claude Code -workerille ja päättyneelle workerille ei voi
  lähettää viestiä. Siksi ilmoituksen teksti vaihtelee agentin ja tilan mukaan:
  - **Pi, käynnissä:** pääagentti voi lähettää workerille viestin.
  - **Claude Code, käynnissä:** viestiä ei voi lähettää kesken työn, mutta
    pääagentti näkee workerin tilan.
  - **Päättynyt:** pääagentti on saanut workerin raportin.
- **Viesti ei vastaa päätteen kehotteeseen.** Jos worker odottaa esimerkiksi
  SSH-kehotteessa, kehotteeseen vastataan vain workerin natiivissa
  päätteessä. Kehotekortin pienessä tekstissä on nyt tämä. Kierroksella 1
  kortti väitti virheellisesti, että pääagentti voi vastata kehotteeseen.

## Kolme suuntaa

Suunnat eroavat kahdessa asiassa: miten pääte vaihtuu keskusteluun, kun
historia tulee luettavaksi (a), ja missä kirjoituskentän puuttumista
koskeva ilmoitus on (b).

| Suunta | (a) Pääte → keskustelu | (b) Ilmoitus | Vahvuus | Hinta |
| --- | --- | --- | --- | --- |
| **1 Välilehti** | Kaistassa ovat välilehdet **Keskustelu \| Pääte**. Kun historiaa ei voi lukea, Keskustelu on himmeä ja Pääte valittuna. Päätteen yläpuolella oleva rivi kertoo syyn: joko Habitat ei vielä lue Claude Code -keskusteluja, tai istuntoa ei ole vielä löytynyt (pyörivä merkki). Kun historia tulee luettavaksi, Keskustelu-välilehteen syttyy piste ja rivi vaihtuu muotoon ”Keskustelu on nyt luettavissa · **Näytä keskustelu**”. Näkymä vaihtuu vasta, kun ihminen valitsee keskustelun. Jos historia on luettavissa jo avattaessa, worker avautuu suoraan keskusteluun. | Kirjoituskentän paikalla on kiinteä palkki, jossa lukee esimerkiksi ”**Workerille ei kirjoiteta suoraan.** Pääagentti voi lähettää sille viestin. Kysy pääkeskustelussa, niin pääagentti välittää kysymyksen.” Palkissa on painike **Kysy pääkeskustelussa ›**. | Kierroksella 1 hyväksytty Kehys säilyy lähes ennallaan. Lukijan alta ei vaihdu mitään, ja ilmoitus näkyy aina samassa paikassa ja sanoo agentista riippuvan totuuden. | Palkki vie pysyvästi yhden tai kaksi riviä, puhelimessa kolme. Historian saapumisen voi ohittaa, jos ei huomaa pistettä. |
| **2 Vaihtuu itse** | Pääte ja sen alla oleva syyrivi ovat samat kuin suunnassa 1. Kun historia tulee luettavaksi, näkymä vaihtuu itse keskusteluun. Yläreunaan tulee rivi ”Näkymä vaihtui keskusteluun, koska workerin historia tuli luettavaksi · **Takaisin päätteeseen**”. | Kirjoituskentän muotoinen kysymyslaatikko, joka on osoitettu **Pääagentille**: ”Kysy workerista pääagentilta…”. **Pääkeskusteluun ›** avaa pääkeskustelun, jonka kirjoituskentässä on luonnos *Workerista »Aikavyöhyketestit kellonäkymälle«: kysymyksesi*. Sinä lähetät sen. **Takaisin workeriin** palaa workeriin. | Kysyminen on suorinta: kysymyksen voi kirjoittaa siellä, missä workeria luetaan. Keskustelu tulee näkyviin ilman toimenpidettä. | Laatikko näyttää kirjoituskentältä, jonka poistamista pyysit, ja Claude-workerin kohdalla se lupaa enemmän kuin pääagentti voi tehdä. Automaattinen vaihto voi viedä päätteen lukijan alta. Tuotannossa vaihto pitäisi estää, jos ihminen on vierittänyt tai valinnut päätteestä tekstiä. Luonnoksen siirto pääkeskusteluun on uutta selainkytkentää, vaikka hostilta ei tarvita uutta tietoa. |
| **3 Pääte keskustelussa** | Välilehtiä ei ole. Keskustelu alkaa aina tehtävästä (**Pääagentti · tehtävä**). Ennen kuin historiaa voi lukea, pääte on tehtävän alla korttina, jonka voi avata koko näkymään. Kortin alalaidassa kerrotaan, milloin keskustelu korvaa sen. Kun historia tulee luettavaksi, workerin vastaukset ja työkalut täyttyvät tilalle, ja pääte painuu keskustelun loppuun yhdeksi riviksi **Pääte · vain luku**. | Ilmoitus on kaistan oikeassa reunassa toimintona: ”Vain luku · kysy pääagentin kautta” (puhelimessa **Kysy**). Pidempi selitys on painikkeen title-tekstissä. Alapalkkia ei ole. | Näkymässä ei ole tilaa, jonka välillä vaihdetaan: Claude-worker näyttää Pi-workerilta heti, kun historia on luettavissa. Tehtävä näkyy alusta asti, ja ruutuun mahtuu eniten keskustelua. | Ilmoitus on hiljaisin ja jää helposti huomaamatta, joten ”miksi en voi kirjoittaa” jää selittämättä. Tehtävän näyttäminen ennen historiaa vaatii hostilta tiedon, jota daemon ei vielä lue (alla). |

Kaikissa suunnissa päättyneen workerin pääte on suljettu. Worker on
päättynyt, ja `run merge` purkaa sen ikkunan. Jos historiaa ei voi lukea,
näkymä sanoo tämän suoraan ja näyttää raportin (tila **Epäonnistui** +
historia **Habitat ei lue**).

## Kokeile

Avaa tiedosto selaimessa:

```
issues/proto-worker-view/prototypes/worker-view-2/index.html
```

Sivu toimii yhdestä tiedostosta ilman verkkoa (CSP estää kaikki pyynnöt).
Suunta vaihtuu valitsimesta tai näppäimillä **1–3** ja **←/→**. Yläpalkissa
ovat seuraavat valinnat:

- **Tila**: Työskentelee, Odottaa päätteessä, Valmis ja laskeutunut,
  Epäonnistui ja tallessa.
- **Worker**: Claude Code (oletus) tai Pi.
- **Claude-historia**: *Ei vielä löytynyt*, *Habitat ei lue (tänään)* tai
  *Luettavissa*.
- **Historia saapuu ▶** tuo historian saataville, kun pääte on auki.
  Tästä näkee jokaisen suunnan vaihtohetken.
- **Tumma / Vaalea**.

Kokeile näitä:

1. Valitse jokaisessa suunnassa Claude Code ja *Ei vielä löytynyt*, ja paina
   **Historia saapuu ▶**. Suunnassa 1 näkymä pysyy päätteessä ja tarjoaa
   keskustelua, suunnassa 2 se vaihtuu itse, ja suunnassa 3 pääte painuu
   keskustelun loppuun.
2. Vaihda Workeriksi Pi ja sitten Claude Code. Ilmoituksen teksti muuttuu sen
   mukaan, voiko pääagentti viestiä workerille. Valitse sitten Tilaksi
   *Valmis* tai *Epäonnistui*.
3. Suunta 2: kirjoita kysymys laatikkoon ja paina **Pääkeskusteluun**.
   Pääkeskustelun kirjoituskentässä on luonnos, ja **Takaisin workeriin**
   palauttaa workeriin.
4. Suunta 1, Pi, **Odottaa päätteessä**: kehotekortti ja alapalkki
   näkyvät yhdessä.
5. **Tiedot** (ⓘ) näyttää myös Claude-workerin historian tilan.

Pääkeskustelun linkit näyttävät vain ilmoituksen. Prototyyppi ei siirry
minnekään eikä lähetä mitään. URL-parametrit
`?v=2&harness=claude&history=pending&state=running&theme=dark` avaavat
suoraan halutun yhdistelmän, ja `&arrived=1` näyttää tilanteen sen jälkeen,
kun historia on saapunut. Kuvat ovat hakemistossa `evidence/` (laitteen
skaalaus 2). Kustakin suunnasta on kuvat Claude-historian tiloista, juuri
saapuneesta historiasta, Pi-workerista ja päättyneestä workerista, sekä
suunnan 2 luonnos pääkeskustelussa. Kaikki ovat 1440 px vaaleana ja 390 px
tummana.

## Mitä hostin pitää tietää

| Tieto | Mistä | Onko tänään |
| --- | --- | --- |
| Claude Code -workerin istuntotiedosto | Claude Code kirjoittaa sen hakemistoon `~/.claude/projects/<worktreen polku, / ja . → ->/<uuid>.jsonl` heti workerin käynnistyessä. Tämän kierroksen oma worker on esimerkki: tiedosto syntyi samalla minuutilla kuin worktree. | **Tiedosto on, mutta Taskfleet ei kerro sitä.** Workerin kättelytiedosto tallentaa vain `pi_session_*`-kentät, ja `node_transcripts` ilmoittaa `support: unsupported`. Worktreen polku on ajokohtainen, joten hakemisto yksilöi ajon. Jos worker käynnistyy uudelleen, hakemistossa voi olla useampi tiedosto. |
| Claude Code -historian lukija | Habitat | **Ei ole.** `readSpinoffTranscript` palauttaa muulle kuin Pi-workerille `unsupported`. Tila *Habitat ei lue* on siksi tämän päivän tila, ja *Ei vielä löytynyt* on lyhyt alkuvaihe sen jälkeen, kun lukija on olemassa. |
| Voiko pääagentti viestiä workerille | Agentti (`harness`) ja tila | **On.** Molemmat ovat jo spinoffien tiedoissa. Sääntö on: vain käynnissä oleva Pi-worker. |
| Tehtävä (brief) keskustelun ensimmäisenä viestinä | Ajohakemiston `~/.taskfleet/runs/<run>/prompt.md` | **Taskfleetissä on**, mutta `run show` ei palauta sitä eikä daemon lue sitä. Suunta 3 tarvitsee sen ennen historiaa. Muissa suunnissa tehtävä näkyy historiasta. |
| Päättyneen workerin pääte | `run merge` purkaa ikkunan. Epäonnistuneen workerin agenttiprosessi on päättynyt. | Laskeutuneen workerin päätettä ei ole. Epäonnistuneen workerin ikkunan kohtaloa ei tarkistettu. Prototyyppi olettaa, että sekin on suljettu. |
| Luonnos pääkeskusteluun (suunta 2) | Selain | **Ei hostitietoa.** Tarvitaan vain uusi kytkentä, joka avaa pääkeskustelun luonnoksen kanssa. |

## Avoimet kysymykset

- Vaihtuuko näkymä keskusteluun itse (suunta 2) vai vasta ihmisen valinnasta
  (suunta 1)?
- Riittääkö kaistan **Kysy**-toiminto (suunta 3), vai tarvitaanko näkyvä
  palkki?
- Onko kysymyslaatikko (suunta 2) hyvä oikotie, vai muistuttaako se liikaa
  kirjoituskenttää, jonka poistamista pyysit?
