# Tulos: arkistoinnin ilmoituksen paikka

Prototyyppi on `prototypes/archive-notice/index.html`, ja se on rakennettu
kierroksesta `design-system/prototypes/rounds/2026-10-28-arkistoinnin-ilmoitus/`.
Tiedosto on yksi offline-HTML, joka on koottu prototyyppikirjastosta, eikä siinä
ole tuotantokomponenttien bundlea. Opas on `prototypes/archive-notice/NOTES.md`,
ja kuvat ovat `prototypes/archive-notice/evidence/`-hakemistossa laitteen
skaalauksella 2.

`verify.mjs` käy läpi kaikki kolme suuntaa ja tuotannon nykyisen paikan
työpöydällä (1440 px) ja puhelimessa (390 px), vaaleana ja tummana. Se
tarkistaa, että:

- arkistointi vie työtilasivulle ja näyttää kuittauksen ilman että fokus siirtyy
  siihen;
- kun seuraava keskustelu avataan ja siihen kirjoitetaan, kuittaus ei peitä
  kenttää eikä Lähetä-painiketta, kun taas tuotannon paikka peittää molemmat;
- Kenttärivi-suunnassa lanka päättyy rivin yläpuolelle;
- Esc kentässä ei sulje kuittausta, ja osoitin pysäyttää sen kellon;
- Palauta tuo keskustelun takaisin ja avaa sen;
- kuittaus poistuu itsestään 8 sekunnin jälkeen;
- roskakorin ja tilanvaihdon ilmoitukset käyttävät samaa paikkaa eivätkä peitä
  kenttää;
- konsoli ja verkko pysyvät puhtaina.

Myös kirjaston `check.mjs` menee läpi ilman virheitä.

Nykytila on luettu koodista: `web/src/components/ArchiveNotice.tsx`,
`components.css` (`.ah-archive-notice`), `App.tsx` (`changeArchive`,
`#overlays`) ja `TrashNotice.tsx`. Labia ei ajettu, koska koodista näkyy suoraan,
että ilmoitus on `position: fixed; bottom: 20px` ja globaali. Juuri siksi se
seuraa navigoinnin mukana seuraavan keskustelun kentän päälle.

## Akseli: missä kuittaus on suhteessa seuraavaan työpintaan

| # | Suunta | Mitä se päättää | Milloin se on oikea | Mitä se maksaa |
|---|---|---|---|---|
| 1 | Ylhäällä | Sama pilleri kuin nyt, mutta näkymän yläpalkin alla keskellä. Peittää vain langan vanhinta osaa. | Jos halutaan yksi paikka kaikille kelluville ilmoituksille ja pienin muutos. Kirjoittaminen ja uusin vastaus pysyvät aina vapaina. | Kuittaus on kaukana siitä kohdasta, jossa käsi ja katse ovat. Puhelimessa se peittää langan yläosaa 8 s ajan. |
| 2 | Kenttärivi | Oma rivi kentän yläreunassa. Lanka väistää, joten mitään ei jää kuittauksen alle. Sivuilla ilman kenttää rivi on alareunassa. | Jos kumoaminen halutaan pitää lähellä sitä kohtaa, jossa ollaan, mutta ei kentän päällä. | Lanka hyppää rivin verran kahdesti. Pinoutuvat ilmoitukset vievät puhelimessa paljon tilaa. Rivi on edelleen siinä kohdassa, jota Jari piti häiritsevänä. |
| 3 | Paikallaan | Ei kelluvaa ilmoitusta. Keskustelun paikalle sivupalkkiin ja työtilasivun listaan jää kuittausrivi, joka pysyy 30 s. | Jos kuittauksen halutaan olevan siellä, minne asia meni, eikä mitään saa kellua. | Puhelimessa kuittaus katoaa näkyvistä, kun seuraava keskustelu avataan, koska valikko on kiinni. Tilanvaihdolle ei ole listapaikkaa, joten kelluva paikka tarvitaan silti. Tuloksena on kaksi järjestelmää. |

## Host-tiedot, joita suunnat tarvitsevat

Mikään suunta ei tarvitse daemonin, gatewayn tai provisionin muutosta. Kaikki
tiedot ovat jo selaimessa. Muutokset ovat käyttöliittymän rakennetta.

| Tieto tai rakenne | Onko olemassa |
|---|---|
| Arkistointi optimistisena mutaationa, vahvistuksen odotus (`busy`) ja palautus | **On**: `changeArchive` ja `conversation.archive`-mutaatio. Palautus vie takaisin kohtaan `archiveNotice.route`. |
| Ilmoitus säilyy navigoinnin yli | **On**: `#overlays` `Navigation.tsx`:ssä. Kaikki suunnat tarvitsevat tämän. |
| Yläpalkin alareuna ilmoituksen paikaksi (suunta 1) | **Osittain.** Ilmoitus on `#overlays`-kerroksessa sisältöalueen ulkopuolella. Sen pitää ankkuroitua sisältösarakkeen yläreunaan, ja sivupalkin leveys on otettava huomioon. Tämä on CSS-muutos tai `#overlays`-kerroksen siirto sisältösarakkeen sisään. Uutta tietoa ei tarvita. |
| Kentän korkeus ja paikka ilmoitukselle (suunta 2) | **Osittain.** `--ah-composer-height` on olemassa, mutta vain `ConversationFrame`n sisällä. Ilmoitus pitää piirtää kehyksen kenttäpaikkaan tai tuoda muuttuja shellin tasolle. Kelluvat kontrollit (`.ah-floating-controls`) lasketaan kentän ja dockin korkeudesta, joten rivi on lisättävä tuohon laskuun. Sivut ilman kenttää tarvitsevat oman paikan. |
| Juuri arkistoitu keskustelu listassa (suunta 3) | **Osittain.** Selain tietää sen (`archiveNotice`-tila), mutta sivupalkki ja työtilasivu suodattavat arkistoidut pois. Kumpikin tarvitsee kuittausrivin. Roskakorin tulos on jo tilassa `trashOutcome`. Tilanvaihdolle ei ole listapaikkaa. |
| Sama paikka muille kelluville ilmoituksille | **On**: `TrashNotice`, tilanvaihto (`modeNotice`) ja työtilan arkistointi (`WorkspacePage`) käyttävät samaa `ArchiveNotice`a. Päätteen `ToastRegion` (`.ah-toast`, oikea alakulma) on erillinen ja jää tämän kierroksen ulkopuolelle. |

## Suositus

**Ylhäällä (1).** Se korjaa Jarin havaitseman ongelman kaikissa tilanteissa
yhdellä paikkamuutoksella. Kenttä, Lähetä-painike ja uusin vastaus pysyvät
vapaina kaikilla sivuilla ja leveyksillä. Kaikki nykyiset `ArchiveNotice`n
käyttäjät, eli arkistointi, roskakori, tilanvaihto ja työtilan arkistointi,
siirtyvät samaan paikkaan ilman omaa logiikkaa. Elinaika, kumoaminen ja
fokuskäytös säilyvät ennallaan.

Kenttärivi pitää kuittauksen juuri siinä kohdassa, jota Jari piti häiritsevänä,
ja liikuttaa lankaa. Paikallaan on hiljaisin vaihtoehto, mutta se jättää
puhelimen ilman näkyvää kumoamista ja vaatii silti kelluvan paikan
tilanvaihdolle.

Toteutus, jos tämä valitaan:

1. `.ah-archive-notice` ankkuroidaan sisältösarakkeen yläreunaan, yläpalkin alle
   keskelle. Eri ilmoitukset pinoutuvat, ja saman lajin uudempi korvaa vanhemman.
2. Esc rajataan toimimaan vain silloin, kun fokus on ilmoituksessa.
3. Mahdollisesti elinajan viiva (kysymys 2).

## Päätökset myöhempää tarkistusta varten

- **Esc sulkee vain ilmoituksen sisältä.** Tuotannossa Esc on globaali.
  Vaihtoehto on pitää se ennallaan. Valitsin rajauksen, koska Esc kentässä tai
  dialogissa ei saa hävittää kumoamisen mahdollisuutta huomaamatta.
- **Elinaika on 8 s, ja se pysähtyy osoittimen tai fokuksen ajaksi.** Tämä on
  tuotannon arvo, jotta akseli pysyy yhtenä. Paikallaan-suunnassa aika on 30 s,
  koska rivi ei peitä mitään. Vaihtoehtoja olisivat pidempi elinaika tai
  sulkeminen vasta seuraavasta navigoinnista.
- **Saman lajin ilmoitus korvaa edellisen, eri lajit pinoutuvat.** Tuotannossa
  ne piirtyvät samaan kohtaan päällekkäin. Vaihtoehto on jono, jossa näkyy yksi
  ilmoitus kerrallaan. Valitsin pinon, koska jonossa myöhempi ilmoitus joutuisi
  odottamaan ja sen kumoamisaika lyhenisi.
- **Elinajan viiva on lisätty kaikkiin suuntiin.** Tuotannossa sitä ei ole. Se
  näyttää, että kuittaus poistuu itsestään ja että osoitin pysäyttää sen.
- **Palauta vie keskusteluun ja kohdistaa sen otsikkoon.** Tuotanto navigoi
  aiempaan reittiin. Vedos tekee saman.
- **Työtilasivu on vedoksessa tiivistetty.** Siinä ovat otsikko, polku, Uusi
  keskustelu ja keskustelulista. Tuotannon `WorkspacePage` sisältää enemmän,
  mutta kuittauksen paikan kannalta sillä ei ole merkitystä.

## Kysymykset Jarille

1. Mikä suunta: Ylhäällä, Kenttärivi vai Paikallaan? Suositus on Ylhäällä.
2. Otetaanko elinajan viiva mukaan toteutukseen?
3. Saako Esc sulkea ilmoituksen mistä tahansa, kuten nyt, vai vain silloin, kun
   fokus on ilmoituksessa?
