# Prototyyppi: sanelu viestikenttään

Kierros `design-system/prototypes/rounds/2026-10-28-sanelu`, tulos
[prototypes/speech-input/index.html](prototypes/speech-input/index.html),
Jarin opas [prototypes/speech-input/NOTES.md](prototypes/speech-input/NOTES.md)
ja kuvat `prototypes/speech-input/evidence/`. Pohjana ovat
research-soniox-speech-input ja Jarin päätös 27.10. (D + P1; sanelu ei
saa katketa minuuttiin, ja katto päätetään prototyypissä).

Rakennus ja tarkistus (rakentaa tiedoston ja ottaa kuvat):

```
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright NODE_PATH=<checkout>/web/node_modules \
  node design-system/prototypes/rounds/2026-10-28-sanelu/verify.mjs
```

## Akseli ja suunnat

Akseli: **mikä päättää pitkän sanelun.** Kaikki muu on suunnissa samaa:
mikrofoni kentän alarivillä, nauhoitusnauha (piste, taso, kesto, tila ja
Valmis), vahvistettu teksti ja himmeä välitulos kentässä, tauot, lopetus,
lähetys kesken sanelun, uudelleenyhdistys sekä virhe- ja ei avainta
-tilat.

| Suunta | Päättää | Soniox-avaimen istuntokatto | Mitä suunta päättää |
| --- | --- | --- | --- |
| 1 Katto | Kiinteä 30 min. Ilmoitus tulee 25 minuutin kohdalla, ja viimeinen minuutti näkyy punertavana. | 1 800 s, eli katon valvoo Soniox | Katto on yksi luku, ja se on sama palvelussa ja näytöllä. Puhuja voi katketa kesken lauseen, mutta *Jatka sanelua* jatkaa samaan kenttään. |
| 2 Hiljaisuus | 3 minuutin hiljaisuus. Ilmoitus tulee 2 minuutin kohdalla. Takaraja on 4 h. | 14 400 s takarajana; hiljaisuutta valvoo selain | Ei aikakattoa puhujalle. Taustapuhe pitää sanelun auki, ja pitkä ajattelutauko päättää sen. |
| 3 Jatkokysymys | Sanelu kysyy 25 minuutin välein, jatketaanko. Jos kysymykseen ei vastata viidessä minuutissa, sanelu päättyy. Takaraja on 4 h. | 14 400 s takarajana; kysymystä valvoo selain | Paikalla olevaa ei katkaista koskaan, ja unohtunut mikrofoni sammuu 30 minuutissa huoneen äänistä riippumatta. Hintana on painallus puolen tunnin välein. |

## Host-faktat, joita näkymä olettaa

| Fakta | Suunta | Onko olemassa |
| --- | --- | --- |
| Daemonin reitti, joka luo henkilön avaimella kertakäyttöisen väliaikaisen avaimen (`single_use`, 60 s, `transcribe_websocket`, istuntokatto) ja palauttaa avaimen, vanhenemisajan ja aluekohtaisen osoitteen | kaikki | Ei. Toteutusissue tekee sen. |
| P1-poikkeus kirjattuna `internal/AGENTS.md`:n sääntöön ”Tokens … never cross the contract” | kaikki | Ei. Jari on hyväksynyt poikkeuksen, mutta sääntöä ei ole vielä päivitetty. |
| Henkilön Soniox-avain ja alue kotihakemistossa (P2, esim. `~/.config/soniox/`) sekä asetussivu *Asetukset › Sanelu* | kaikki | Ei |
| Ylläpitäjän Soniox-avain palvelinasetuksissa ja sen kopiointi koteihin (D, AI-avaimen kaava; oma avain edellä) | kaikki | Ei. AI-avaimen kaava on olemassa, Soniox-avainta ei. |
| Sopimuksen kiinteät virhekoodit: ei avainta, avain hylätty, raja täynnä, Soniox ei vastaa | kaikki | Ei |
| Mikrofoni ja `wss://stt-rt(.eu).soniox.com` sallittuja pääoriginilla (ei `Permissions-Policy`- tai `connect-src`-estoa) | kaikki | On (research: pääoriginilla vain `frame-ancestors 'none'`) |
| Välitulos ja vahvistettu teksti erillään (`is_final`) sekä viimeistely lopetettaessa (`finalize` tai tyhjä kehys) | kaikki | On (Sonioxin rajapinta) |
| Keepalive tauoilla, vähintään 40 s välein | kaikki | On (Sonioxin rajapinta). Tukeeko `@soniox/client`-SDK sitä itse, on tarkistettava. |
| Uusi väliaikainen avain kesken sanelun uudelleenyhdistystä varten. Daemonin raja ”yksi avoin sanelu per sessio” sallii vaihdon. | kaikki | Ei. Rajaa ei ole vielä olemassa, ja sen suunnittelussa pitää huomioida tämä. |
| Äänen puskurointi katkon ajaksi, jotta sanoja ei katoa | kaikki | Ei tiedossa. SDK:n uudelleenyhdistyksen käytös on tarkistettava. |
| Istuntokatto 1 800 s väliaikaisessa avaimessa | 1 | On (`max_session_duration_seconds` 1–18 000) |
| Istuntokatto 14 400 s (4 h, alle Sonioxin 300 min/stream -rajan) | 2, 3 | On |
| Hiljaisuuden mittaus selaimessa: viimeisen tokenin aikaleima tai äänitaso | 2 | Tokenien aikaleimat ovat Sonioxin vastauksissa. Mittaus tehdään selaimessa itse. |
| Ajastin, joka toimii taustavälilehdessä: selain harventaa ajastimia piilossa, joten raja tarkistetaan seinäkellosta eikä ajastimien määrästä | 2, 3 | Selainkoodin asia. Suunnassa 1 Soniox on lopullinen raja. |

Provision ei osallistu mihinkään suuntaan, eikä mikään suunta siirrä
valtuutta gatewayn, daemonin ja provisionin välillä nykyisen päätöksen
(D + P1) ulkopuolelle.

## Suositus

**Jatkokysymys**, istuntokattona 4 tuntia. Peruste: Jari halusi, ettei
sanelu katkea puhujalta, ja Jatkokysymys on ainoa suunta, jossa paikalla
olevaa ihmistä ei katkaista lainkaan. Samalla unohtunut mikrofoni sammuu
puolessa tunnissa myös meluisassa huoneessa. Hiljaisuus pettää juuri
silloin, kun mikrofoni on unohtunut palaveriin tai television viereen:
kenttään kertyy muiden puhetta, ja ääni kulkee Sonioxille tunteja. Katto
on rehellisin ja yksinkertaisin, mutta se katkaisee 30:00 kohdalla myös
sen, joka on keskellä ajatusta. Jos halutaan pienin toteutus, Katto on
hyvä ensimmäinen versio: siinä on vain yksi luku, ja Jatkokysymyksen voi
lisätä sen päälle myöhemmin muuttamatta mitään muuta.

Jatkokysymyksen kortti ei pysäytä nauhoitusta eikä siirrä kohdistusta
kentästä. Kysymykseen vastataan vain painalluksella, koska puhe ei todista
läsnäoloa.

## Päätökset myöhempää tarkastelua varten

- **Katon luvut.** Katossa 30 min ja ilmoitus 25 minuutin kohdalla.
  Hiljaisuudessa 3 min ja ilmoitus 2 minuutin kohdalla. Jatkokysymyksessä
  25 + 5 min. Takaraja on 4 h. Vaihtoehdot: 60 min katto, kuten Jarin
  ylärajaehdotus, tai 5 tunnin takaraja, joka on Sonioxin oma 300 min.
  Peruste: 30 min kattaa käytännössä jokaisen agentille sanellun viestin,
  ja neljä tuntia jättää marginaalia Sonioxin rajaan.
- **Mikrofoni näkyy myös ilman avainta**, ja painallus kertoo, mistä avain
  saadaan. Vaihtoehto: piilottaa painike, kunnes avain on. Peruste: piilotettua
  ominaisuutta ei löydä, eikä ihminen tiedä, että ylläpitäjä voi lisätä yhteisen avaimen.
- **Yli neljän sekunnin tauko aloittaa uuden kappaleen.** Vaihtoehdot:
  ei kappalejakoa (Sonioxin raakateksti) tai Sonioxin endpoint-tunnistus.
  Peruste: puolen tunnin sanelu yhtenä kappaleena on lukukelvoton, ja
  tauko on luontevin kappaleen raja.
- **Kenttään ei voi kirjoittaa sanelun aikana**, vaan kenttä näyttää
  sanelun. Vaihtoehto: kirjoittaminen ja sanelu yhtä aikaa. Peruste:
  samanaikainen kirjoitus ja muuttuva välitulos samassa kohdassa sotkevat
  toisensa. Lopetus on yksi painallus tai Esc.
- **Sanelu jatkaa olemassa olevan tekstin loppuun**, ei kursorin kohtaan.
  Vaihtoehto: kursorin kohta. Peruste: lopun käytös on ennustettava eikä
  riipu siitä, minne kursori jäi. Kursorin kohta on mahdollinen myöhemmin.
- **Sanelua ei voi hylätä yhdellä painalluksella.** Valmis ja Esc
  säilyttävät tekstin. Vaihtoehto: *Hylkää*-painike nauhaan. Peruste:
  20 minuutin sanelun vahinkohylkäys olisi peruuttamaton. Tekstin voi
  poistaa kentästä tavalliseen tapaan.
- **Lähetä kesken sanelun** viimeistelee sanelun ja lähettää viestin.
  Vaihtoehto: Lähetä on pois käytöstä sanelun ajan. Peruste: sanelu
  päättyy usein juuri lähetykseen.
- **Pidä pohjassa -toiminto** on napautuksen rinnalla: yli puolen sekunnin
  painallus tarkoittaa, että sanelu loppuu painikkeen päästäessä.
  Vaihtoehto: vain napautus. Peruste: lyhyt ohjaus puhelimessa on
  luontevin pidä pohjassa -eleellä, eikä se haittaa pitkää sanelua.
- **Katkon jälkeen yhdistetään kerran uudelleen** uudella väliaikaisella
  avaimella. Jos yhteys ei palaa, keskeneräiset välitulokset jäävät
  tekstiksi ja ilmoitus kertoo, että viimeiset sanat voivat olla
  epätarkkoja. Vaihtoehto: välitulokset hylätään. Peruste: epätarkka
  sana on helpompi korjata kuin kadonnut sana.
- **Virheet näkyvät kentän alla** samassa paikassa kuin tuotannon
  ilmoitukset (`ah-composer-notice`). Katon lähestyminen näkyy kentän
  yllä samassa paikassa kuin jonokortti.

## Kysymykset Jarille

1. Mikä suunta, ja kelpaavatko luvut (30 min, 3 min, 25 + 5 min, 4 h)?
2. Ennen toteutusta research suositti kahta tarkistusta oikealla
   avaimella: suomen sanelun laatu ja iOS Safarin ääniformaatti. Teetkö
   Soniox-tilin, vai tehdäänkö ne toteutusissuen ensimmäisenä askeleena?
