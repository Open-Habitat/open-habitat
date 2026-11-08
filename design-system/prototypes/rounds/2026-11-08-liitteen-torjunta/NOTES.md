# Liitteen torjunta – kierros 1

Issue `proto-attachment-refusal`. Jari 8.11. testipalvelimella: liian suuri
liite näyttää kentän yllä paljaan rivin *Valitse 1 tavun – 20 MiB:n
tiedosto.* Rivi ei näytä muilta varoituksilta, ei kerro, mikä tiedosto jäi
pois, eikä sitä, mitä voi tehdä.

Akseli: missä ja missä muodossa hylätty liite kerrotaan. Sanat ja
käytös (mikä menee läpi ja mikä ei) ovat kaikissa kolmessa suunnassa samat;
vain esitys vaihtuu.

0. **Nyt**: paljas virherivi kentän yllä; ensimmäinen hylätty tiedosto lopettaa koko pudotuksen, eikä nimeä kerrota.
1. **Varoitus**: punainen yhteinen varoitus kentän yllä: tiedoston nimi otsikkona, raja ja mitä tehdä alla; monesta tiedostosta lista.
2. **Siru**: hylätty tiedosto on punainen siru liitteiden rivissä syy sirussa; sirua painamalla näkyy raja ja mitä tehdä.
3. **Rivi**: yksirivinen punainen varoitus: nimi, syy ja mitä tehdä; monesta tiedostosta määrä ja Näytä-painike listaan.

Suositus: **Varoitus**.

Jokaisessa suunnassa on kaksi komposeria rinnakkain (puhelimessa allekkain).
Vasemmalla Jarin tapaus, yksi 34 Mt:n video. Oikealla valittu tapaus,
oletuksena *Monta kerralla*: viisi tiedostoa, joista kaksi kelpaa, kaksi on
yli 20 Mt ja yksi tyhjä. *Oikealla*-valinnassa ovat kaikki torjunnat: liian
suuri, tyhjä, yli 30 tiedostoa, yli 100 Mt yhteensä, liitetila täynnä,
palvelimen levy täynnä ja yhteyden katkeaminen. *Kieli* vaihtaa englantiin,
ja *Alusta* toistaa liittämisen. Liitä-napista voi valita myös omia
tiedostoja; ne menevät läpi, ellei koko- tai määräraja ylity.

Nyt on tuotannon `Composer` muuttamattomana ja keksityllä hostilla, joka
vastaa kuten daemon. Suunnat ovat kierroksen kopio siitä
(`forkComposer.tsx`). Kopio on commitoitu ensin sellaisenaan, joten sen
diff seuraavaan commitiin on suuntien speksi. `refusal.tsx` sisältää
yhteisen tilan, sanaston ja kolme esitystä.

## Mitä tänään tapahtuu (koodista luettu)

- Selain tarkistaa vain tiedoston koon (1 tavu – 20 MiB) ja määrän (30
  viestiä kohden). Yksi virhe lopettaa koko pudotuksen. Jo tallennetut
  tiedostot jäävät, myöhempiä ei yritetä, eikä niistä kerrota
  (`Monta kerralla`: vain `kuvakaappaus.png` menee läpi, `kaavio.pdf` jää
  hiljaa pois).
- Yli 30 tiedoston pudotus hylätään kokonaan, myös ne, jotka mahtuisivat.
- 100 MiB:n yhteisraja huomataan vasta lähetettäessä: host hylkää viestin
  (`invalid_attachments`), ja keskustelu näyttää oman varoituksensa.
- Liitetilan 1 GiB:n kiintiö (413 `attachment_quota_exceeded`) näkyy
  tekstinä *Liitettä ei tallennettu. Tarkista koko ja vapaa tila.*
- Täysi levy (507 `attachment_storage_full`) on hostille varma
  epäonnistuminen, mutta selain lukee jokaisen 5xx:n epävarmaksi ja sanoo
  *Liitteen tallennusta ei voitu vahvistaa. Älä lähetä viestiä ennen
  tarkistusta.*
- Katkennut yhteys näyttää selaimen raa'an englanninkielisen virheen
  *Failed to fetch*, koska `Composer` näyttää poikkeuksen tekstin sellaisenaan.
- Tiedostotyyppiä ei torjuta missään: host ottaa minkä tahansa tavujonon.
  "Ei tuettu" -tapausta ei siis ole.

## Mitä suunnat muuttavat yhteisesti

- Jokainen tiedosto tarkistetaan erikseen. Kelvolliset menevät läpi,
  hylätyt nimetään syineen. Yli 30:sta liitetään ensimmäiset, kunnes 30
  täyttyy, ja loput nimetään.
- Yhteisraja tarkistetaan liitettäessä niiden liitteiden koosta, jotka on
  tallennettu tältä sivulta. Aiemmalta sivulta palautetun luonnoksen
  liitteitä selain ei tunne. Silloin host hylkää lähetyksen kuten nyt.
- Hostin koodi säilyy virheessä: kiintiö, täysi levy ja muu
  epäonnistuminen sanotaan eri sanoin. Täysi tila tai levy hylkää samalla
  pudotuksen loputkin tiedostot, koska ne epäonnistuisivat samoin.
- Katkenneen tallennuksen tiedosto säilyy selaimessa, ja *Yritä uudelleen*
  tallentaa sen. Epävarma tallennus luetaan tässä katkenneeksi: uusi yritys
  luo uuden liitteen, eikä vanha mahdollinen jäänne näy luonnoksessa.
- Sanat: raja vain silloin, kun se ylittyy (*enintään 20 Mt*), tiedoston
  koko lähellä Mt:n tarkkuudella, ja aina se, mitä voi tehdä.
- Ilmoitus poistuu ✕:llä tai seuraavalla liittämisellä.

## Mitä kukin suunta päättää

- **Varoitus** käyttää yhteistä `WarningBanner`ia sellaisenaan
  (danger, otsikko, teksti, toiminnot). Se on näkyvin. Yksi tiedosto: nimi
  ja syy otsikossa, raja ja neuvo alla. Monta: määrä otsikossa, jokainen
  tiedosto lyhyen syyn kanssa ja neuvo kerran syytä kohden. Vie eniten tilaa
  kentän yläpuolelta (kolme hylättyä: noin 200 px).
- **Siru** näyttää torjunnan siellä, minne tiedosto olisi mennyt.
  Hylätyt ovat omana rivinään hyväksyttyjen yllä punaisina, ja niiden nimi on
  yliviivattu. Sirussa on vain lyhyt syy (*yli 20 Mt*). Neuvo näkyy, kun
  sirua painaa, ja ruudunlukija lukee koko lauseen sirun nimestä. Yhteistä
  varoitusta ei käytetä, joten sävy on oma (sama virhepinta ja reuna).
  Puhelimessa jokainen siru vie oman rivinsä.
- **Rivi** on yhteinen varoitus ilman otsikkoa, yhdellä rivillä. Yksi
  tiedosto: nimi, lyhyt syy ja neuvo. Monta: määrä ja syyt, ja Näytä avaa
  listan, jossa jokaisella on oma lauseensa. Puhelimessa kirjaston
  `WarningBanner`in rivimuoto rivittyy merkin alle (rungon flex-basis on
  18rem), joten kierros ohittaa sen omalla säännöllään. Ehdotus kirjastoon:
  rivimuodon runko `flex-basis: 0`.

## Suositus

**Varoitus.** Jarin havainto oli, että virhe ei näytä muilta virheiltä ja
jättää kertomatta, mikä tiedosto jäi pois ja mitä tehdä. Varoitus on juuri
se yhteinen muoto, ja otsikko kertoo tiedoston nimen ennen kuin mitään
muuta tarvitsee lukea. Torjunta on harvinainen, joten sen tilan vienti on
pieni hinta. Siru on tyylikkäin, mutta neuvo jää painalluksen taakse eikä
se ole yhteinen varoitus. Rivi säästää tilaa, mutta yksittäinen tiedosto
rivittyy silti kahdelle riville, ja monen tiedoston syyt jäävät painikkeen
taakse.

## Host-tiedot

Ei uutta hostin tietoa eikä rajapintaa. Rajat ovat daemonin nykyiset
(`attachments_linux.go`): 20 MiB tiedostoa, 30 tiedostoa ja 100 MiB
viestiä kohden, 1 GiB liitetilaa (vain `attachments`-kansio, eikä vanhoja
liitteitä poisteta automaattisesti). Muutos on selaimessa:
`uploadAttachment` heittää hostin koodin eikä sanottua tekstiä, ja 507
luetaan varmaksi epäonnistumiseksi.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-08-liitteen-torjunta/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 500 \
  node design-system/prototypes/rounds/2026-11-08-liitteen-torjunta/check.mjs \
  design-system/prototypes/dist/liitteen-torjunta/offline.html <kuvahakemisto>
```

`web/node_modules` tarvitaan lukitiedoston mukaisena (`npm ci` tai linkki
päächeckoutin samaan lukkoon). Tarkistus: 143 tarkistusta, konsoli puhdas.
