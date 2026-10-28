# Arkistoinnin ilmoituksen paikka

Avaa `index.html` selaimessa. Se on yksi offline-tiedosto, joka on rakennettu
prototyyppikirjastosta eikä tuotantokomponenteista. Rakennus ja tarkistus tehdään
komennolla
`node design-system/prototypes/rounds/2026-10-28-arkistoinnin-ilmoitus/verify.mjs`
(Playwright `web/node_modules`ista). Kuvat ovat `evidence/`-hakemistossa laitteen
skaalauksella 2.

## Mistä ongelma tulee

Tuotannossa arkistoinnin ilmoitus (`ArchiveNotice`) on kiinnitetty selainikkunan
alalaitaan keskelle, 20 px reunasta. Se ei kuulu mihinkään näkymään, joten se
seuraa mukana, kun siirryt toiseen näkymään. Arkistointi vie työtilasivulle.
Kun avaat sieltä seuraavan keskustelun, ilmoitus on kentän ja Lähetä-painikkeen
päällä 8 sekuntia. Jos osoitin tai fokus on ilmoituksessa, se pysyy siinä niin
kauan. Sivun yläpalkin **Nykyinen**-valinta näyttää tämän tuotannon paikan missä
tahansa suunnassa. Kuvat `0-nykyinen-*` näyttävät saman tilanteen.

## Kokeile näin

1. Olet työpuukeskustelussa *Kuvien pakkaus WebP-muotoon*
   (`wt/webp-pakkaus`). Paina yläpalkin arkistointi-ikonia. Vahvistusta ei
   kysytä, kuten ei tuotannossakaan.
2. Päädyt työtilasivulle `aurinkokello`, ja kuittaus ilmestyy. Palauta on noin
   puoli sekuntia harmaana, kunnes palvelin on vahvistanut arkistoinnin.
3. Avaa *Status-skripti* listasta tai sivupalkista ja ala kirjoittaa. Tässä
   kohdassa näet eron.
4. Kokeile myös **Uusi keskustelu**. Silloin fokus menee suoraan kenttään.
5. **Palauta** palauttaa keskustelun ja avaa sen uudelleen. **×** ja Esc
   sulkevat kuittauksen.
6. Sivun yläpalkin **Poista työtila** ja **Tilanvaihto** tuovat kaksi muuta
   kelluvaa ilmoitusta, roskakorin ja yhden työtilan tilan. Niistä näet, toimiiko
   sama paikka niillekin. **Arkistoi alusta** aloittaa tarinan uudelleen.

## Sama kaikissa suunnissa

- **Elinaika 8 s**, kuten tuotannossa. Kuittauksen alareunan ohut viiva näyttää
  jäljellä olevan ajan. Aika pysähtyy, kun osoitin tai fokus on kuittauksessa,
  ja jatkuu siitä, mihin jäi. Kun arkistointi on vielä kesken, aika ei kulu.
- **Kuittaus ei vie fokusta.** Arkistoinnin jälkeen fokus on työtilasivun
  otsikossa, kuten tuotannossa. Jos fokus oli kuittauksessa sen sulkeutuessa,
  se palaa kenttään.
- **Esc sulkee kuittauksen vain, kun fokus on siinä.** Tuotannossa Esc sulkee
  sen mistä tahansa, myös kentästä. Silloin kumoamisen mahdollisuus voi kadota
  huomaamatta.
- **Palauta** palauttaa keskustelun ja vie takaisin siihen.
- **Samanlainen ilmoitus korvaa edellisen, eri ilmoitukset pinoutuvat.**
  Tuotannossa ne piirtyvät samaan kohtaan päällekkäin.

## Suunnat (akseli: missä kuittaus on suhteessa seuraavaan työpintaan)

1. **Ylhäällä.** Tuotannon pilleri siirtyy yläpalkin alle keskelle. Se peittää
   langan vanhinta osaa, ei kenttää, Lähetä-painiketta eikä uusinta vastausta.
   Paikka toimii kaikilla sivuilla samalla tavalla, myös työtila- ja
   asetussivuilla.
2. **Kenttärivi.** Kuittaus on oma rivinsä kentän yläreunassa. Lanka lyhenee
   sen ajaksi, joten mitään ei jää kuittauksen alle. Kuittaus on lähellä
   kohtaa, jossa kirjoitat, mutta ei kentän päällä. Kun sivulla ei ole kenttää
   (työtilasivu), rivi on sivun alareunassa.
3. **Paikallaan.** Kelluvaa ilmoitusta ei ole lainkaan. Keskustelun paikalle
   sivupalkkiin ja työtilasivun listaan jää katkoviivainen rivi *Arkistoitu:
   … Palauta*. Rivi saa pysyä 30 sekuntia, koska se ei peitä mitään.
   Roskakoriin siirretty työtila jää samalla tavalla riviksi sivupalkkiin.
   Tilanvaihdolla ei ole omaa paikkaa listassa, joten se näkyy ylhäällä kuten
   suunnassa 1.

## Mitä katsoa

- Puhelimella (390 px) Ylhäällä peittää langan yläosaa, Kenttärivi vie pystytilaa
  kentän yltä, ja Paikallaan-suunnassa kuittaus näkyy vain työtilasivulla ja
  avatussa valikossa. Mikä näistä haittaa vähiten?
- Paina **Poista työtila** ja **Tilanvaihto** peräkkäin. Kolme Kenttärivin
  ilmoitusta vie puhelimessa jo kolmasosan näytöstä.
- Tarvitaanko kuittaukseen elinajan viivaa, vai riittääkö pelkkä kuittaus?
