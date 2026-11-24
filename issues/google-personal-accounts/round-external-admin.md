# External-sovellus: nykytila ja ylläpitäjän puolen kierros (24.11.2026)

## Tiivistelmä

21.11. toteutettu ohje kysyy uudelta ylläpitäjältä, kenen tilit saavat
yhdistää, ja vie External-polun julkaisuun asti. Se ei auta ylläpitäjää,
jonka sovellus on jo asetettu Internaliksi. Hänen Google-rivinsä sanoo
"Tarjolla" täsmälleen kuten External-sovelluksella. Henkilö näkee ennen
Googlea saman ehdollisen huomautuksen kuin muutkin. Henkilökohtaisella
Gmaililla hän päätyy Googlen sivulle "Pääsy estetty … Virhe 403:
org_internal", eikä Google palaa sieltä Habitatiin. Habitatin oma selitys
org_internal-virheelle on olemassa, mutta se on ohjepaneelin viidestä
pysäytyksestä toisena, eikä henkilö etsi sitä, kun hän on jo Googlen
virhesivulla.

Kierroksen akseli: **mistä ylläpitäjä, ja hänen kauttaan henkilö, tietää,
kenen tilit sovellukseen pääsevät.**

- **A Kysy Googlelta.** Habitat ei muista mitään. Rivi sanoo sen ääneen ja vie
  tarkistukseen.
- **B Ilmoitettu yleisö.** Ylläpitäjä ilmoittaa Googlen tilan tunnusten
  rinnalle. Rivi ja henkilön ikkuna kertovat sen ennen Googlea.
- **C Kokeile itse.** Valintaa ei muisteta. Habitat lukee ylläpitäjän oman
  Gmail-yhteyden tuloksen.

Suosittelen B:tä. Se kumoaa 21.11. päätöksen "Habitat ei muista
yleisövalintaa", ja siksi se on kysymys 1. Silloin päätös tehtiin ehdolla:
palataan, jos henkilön ehdollinen ohje osoittautuu sekavaksi. Nyt henkilö
on käytännössä törmännyt Googlen 403-sivuun ilman ennakkovaroitusta. Vain
B pystyy kertomaan henkilölle ennen Googlea, ettei henkilökohtainen tili
käy tällä palvelimella.

Kaikissa suunnissa on sama sisältö: julkaisuvaiheessa ei ole enää
oletusvalintaa (tänään Testing on valmiiksi valittu ja Seuraava toimii
heti), yksi "Joku ei pääse yhdistämään…" -ohje Googlen pysäytyksille ja
vastaus siihen, mitä uusi henkilö tarvitsee.

Rakennettu sivu: `design-system/prototypes/dist/google-external-admin/offline.html`
(ei versionhallinnassa). Rakennetaan komennolla
`node design-system/prototypes/rounds/2026-11-24-google-external-admin/build.mjs`.
Valitsimen Nyt-välilehdellä ovat nykytilan kaappaukset. Kuvat ovat
rakennuskoneella hakemistossa `/var/tmp/agent-keep/google-external-admin/today/`,
tarkistuksen ruutukaappaukset hakemistossa `…/check/`.

## Nykytila (kaappaukset)

Kuvat on otettu synteettisestä labista tuotannon koodilla
(`capture.spec.ts` kierroshakemistossa): fi, 1440 ja 390, vaalea. Googlen
omia sivuja ei kaapattu. Habitat ei näe niitä, eikä oikeaa tiliä käytetty.

Ylläpitäjä:

- **Kenen tilit** (`a02`, `a03`): kaksi korttia, ei oletusta, ja lause
  "Habitat ei tallenna valintaa".
- **Myös henkilökohtaiset** (`a04`–`a08`): rajapinnat, nimi ja tietosuoja
  sekä varoituksen kuvitus, oikeudet ja julkaisu. **Julkaisussa Testing on
  valmiiksi valittu** (`a04-personal-publish`), ja Seuraava toimii ilman
  julkaisua. Sitten asiakas, viesti työtilin ylläpitäjälle ja kokeiltavat.
- **Vain organisaation tilit** (`b01`–`b04`): rajapinnat, nimi ja Internal,
  oikeudet, kokeile. Lopuksi rivi, joka on sama kuin External-sovelluksella.
- **Rivin valikko "Kenen tilit…"** (`a10`–`a13`) käy olemassa olevan
  asiakkaan läpi. Se kertoo, mitä tehdä, mutta se pitää avata itse.

Henkilö:

- **Taso ja ennen Googlea** (`p02`, `p03`): sama Internal- ja
  External-sovelluksella, koska Habitat ei tiedä eroa.
- **Ohje** (`p04`–`p06`): "Sovellus on vain sen organisaation tileille"
  sekä koodi `org_internal`, varoitus ja kuvituskaistat.
- **Keskeytit Googlessa** (`p08`): kirjautuminen pysyy auki.
- **Keinotekoinen kuva** (`p09`): `error=org_internal` paluuosoitteessa
  näkyy geneerisenä "Google lopetti kirjautumisen virheellä org_internal".
  Oikeasti Google ei palaa tähän; kuva näyttää vain, ettei koodilla ole
  omaa selitystä.
- **Yhdistetty** (`p11`): myönnetyt palvelut.

## Aukot

1. **Ylläpitäjä ei saa tietää, että Internal torjuu henkilökohtaiset tilit.**
   Tieto on vain ohjeen ensimmäisessä vaiheessa, jonka vanha ylläpitäjä on
   ohittanut. Rivi ei erota Internalia Externalista.
2. **Henkilö ei saa tietää sitä ennen Googlea.** Habitat ei voi siepata
   Googlen 403-sivua. 21.11. päätöksen seuraus on, että henkilön ikkuna
   puhuu aina ehdollisesti eikä voi sanoa "tämä palvelin ei hyväksy
   henkilökohtaista tiliä".

   Voisiko jokin hostin fakta kertoa tämän muistamatta valintaa?
   - Asiakkaan yleisöä ei voi lukea Googlelta. Client ID ja secret eivät
     anna pääsyä projektin asetuksiin.
   - Ylläpitäjän ilmoittama asetus on muistamista, mutta ylläpitäjän
     väitteenä eikä Googlen tilan kopiona (suunta B).
   - Epäonnistuneen paluun tunnistus on heikko näyttö. org_internal ei
     palaa, joten Habitat näkee vain kirjautumisen, joka vanheni palaamatta.
     Sen voi kysyä henkilöltä (C:n henkilön puoli), mutta se ei kerro syytä.
   - Vahva fakta on oma havainto. Ylläpitäjän oma @gmail.com-yhteys, joka
     toimii, todistaa Externalin. Yli 7 päivää toiminut yhteys todistaa,
     ettei sovellus ole Testing-tilassa (suunta C).
3. **Testing-tila jää helposti päälle vahingossa.** Julkaisuvaiheen oletus
   on Testing, ja Seuraava toimii heti. Seitsemän päivän katkos näkyy
   henkilölle tavallisena "kirjaudu uudelleen" -tilana, eikä kumpikaan
   osapuoli saa syytä selville.
4. **Henkilön lisääminen.** Kun ylläpitäjä hyväksyy uuden henkilön, mikään
   ei kerro, mitä Google vaatii. Internalissa henkilö tarvitsee
   organisaation tilin. Testingissä hänet pitää lisätä Test users -listalle,
   ja yhteys katkeaa silti 7 päivässä. In productionissa ei tarvita mitään,
   mutta henkilö vie paikan sadan käyttäjän rajasta.
5. **Ylläpitäjällä ei ole ohjetta, kun henkilö kertoo virheestä.** Henkilön
   ohjeessa on seitsemän tapausta, ylläpitäjällä ei yhtään.

## Suunnat

Yhteistä kaikille: julkaisuvaiheessa ei ole oletusta. Seuraava odottaa
vastausta "In production", tai Testing-tilan valintaa linkistä "Jätän
Testing-tilaan tarkoituksella". Rivin alla on "Joku ei pääse
yhdistämään…": henkilöltä kysytään, mitä Googlen sivulla luki
(org_internal, access_denied, katkos viikon päästä, admin_policy_enforced,
täysi raja, rate_limit, varoitus). Jokaiselle tulee syy, mitä ylläpitäjä
tekee ja valmis viesti henkilölle. org_internal-tapauksesta pääsee
tuotannon "Kenen tilit…" -kävelyyn, ja työtilin estosta tuotannon viestiin
toisen organisaation ylläpitäjälle. Uuden henkilön vastaus annetaan
kolmelle tilalle.

### A Kysy Googlelta

Rivi: "Kenen tilit: Habitat ei näe tätä Googlesta. Tarkista…".
Tarkistus kysyy Googlen omin sanoin User typen ja Publishing statuksen
ilman oletusta. Vastaus kertoo, mitä tila tarkoittaa ja mitä uusi henkilö
tarvitsee, ja Internalissa se tarjoaa "Salli myös henkilökohtaiset
tilit…". Uuden asetuksen viimeinen vaihe on sama tarkistus. Mitään ei
tallenneta.

Henkilön puoli: Habitat ei tiedä enempää kuin nyt. Ohjeen Google
pysäytti -listassa on ensimmäisenä "Pääsy estetty · org_internal" Googlen
sanoin ja valmis viesti ylläpitäjälle.

Host-tiedot: ei uusia.

### B Ilmoitettu yleisö (suositus)

Rivi: merkki "Vain organisaation tilit", ilmoituspäivä ja seuraus
("Henkilökohtaiset Gmail-tilit eivät voi yhdistää"), ja toiminnot
Muuta…, Uusi henkilö… ja Joku ei pääse… Testing näkyy varoituksena
("Yhteydet katkeavat 7 päivässä"), ja Julkaisin…-linkki päivittää sen.
Uudessa asetuksessa yleisö- ja julkaisuvastaus tallentuvat tunnusten
kanssa, ja ohje sanoo, mitä tallentuu. Muuta…-ikkuna kysyy saman kuin A,
mutta tallentaa vastauksen. Ikkuna sanoo myös, ettei Habitat voi
tarkistaa ilmoitusta eikä huomaa Googlessa tehtyä muutosta.

Henkilön puoli: Internalissa ennen Googlea lukee "Tämä palvelin
hyväksyy vain organisaation Google-tilit. Henkilökohtainen @gmail.com-tili
ei käy.", ja tarjolla on pyyntö ylläpitäjälle kopioitavaksi. Organisaation
tilillä voi jatkaa silti, koska ilmoitus voi olla vanhentunut. Testingissä
lukee "vain testaajat, yhteys katkeaa 7 päivässä", ja In productionissa on
nykyinen varoitus ilman sanaa "voi".

Host-tiedot ja arkkitehtuuri: uusi kenttä Googlen asiakkaan rinnalle
palvelimen integraatiotiedostoon (`internal`, `testing`, `production`),
lisäksi ilmoittaja ja aika, ja sama kenttä katalogin Google-palveluun
henkilön daemonille. Valta ei siirry minnekään: sivuston ylläpitäjä
kirjoittaa jo asiakkaan, ja henkilön daemon lukee jo saman tiedoston.
Kyse on kuitenkin uudesta tallennetusta faktasta ja muutoksesta
`contracts/v1`-sopimukseen, joten se kirjataan issueen ennen koodia.

### C Kokeile itse

Rivi: "Henkilökohtaisella tilillä ei ole kokeiltu tällä palvelimella.
Kokeile omalla Gmaililla…". Tieto luetaan ylläpitäjän omasta
integraatiolistasta, joka on hänen oma daemoninsa ja hänen oma
istuntonsa. Toimiva @gmail.com-yhteys näkyy rivillä muodossa "Toimii
henkilökohtaisella tilillä: oma yhteytesi … on toiminut 12 päivää" (yli
7 päivää tarkoittaa, ettei sovellus ole Testing-tilassa). Pysähtynyt
kokeilu johtaa kysymykseen "Mitä Googlen sivulla luki?". Jos oma yhteys
katkeaa 7 päivän kohdalla, rivi sanoo "Sovellus on todennäköisesti
Testing-tilassa". Ylläpitäjälle, jolla ei ole henkilökohtaista tiliä,
näytetään A:n tarkistus.

Henkilön puoli: ylläpitäjän kokeilu on hänen tiliään, joten sitä ei
näytetä toiselle käyttäjälle. Unix-raja pitää. Henkilön oma daemon
huomaa, kun kirjautuminen vanhenee palaamatta, ja kysyy, pysäyttikö
Google. Se huomaa myös 7 päivän katkoksen ja sanoo sen kortilla.

Host-tiedot: yhteyden syntyaika tilille, eli daemonin havainto
tokenin myöntämisestä. Sitä ei nyt ole sopimuksessa. Lisäksi tarvitaan
katkoksen syy (`invalid_grant`). Kumpikaan ei siirrä valtaa, mutta
molemmat ovat sopimuslisäyksiä.

## Suositus

**B.** Ongelma, jonka henkilö kohtasi, on juuri se, mitä A ja C eivät
voi ratkaista: henkilö saa tietää vasta Googlen virhesivulla. B kertoo
sen ennen Googlea, ja ylläpitäjälle se kertoo vanhan valinnan
seuraukset rivillä joka kerta. Ilmoitus voi vanhentua, mutta se on
ylläpitäjän merkitty väite päiväyksineen, eikä se lukitse henkilöä ulos.

C:n oma kokeilu on hyvä lisä myöhemmin. Se on ainoa todellinen näyttö,
mutta se ei ylitä käyttäjärajaa eikä auta henkilöä ennen Googlea. A on
vähimmäiskorjaus, jos Jari pitää 21.11. päätöksen. Julkaisuvaiheen
oletuksen poisto ja "Joku ei pääse yhdistämään…" kannattaa toteuttaa
joka tapauksessa, koska ne eivät vaadi uutta tietoa.

## Kysymykset Jarille

1. **Saako Habitat nyt muistaa ylläpitäjän ilmoittaman Googlen tilan
   (B)?** Suositus: kyllä, merkittynä ylläpitäjän ilmoitukseksi
   päiväyksineen. Tämä kumoaa 21.11. päätöksen, ja kirjaan sen
   arkkitehtuurimuutoksena issueen ennen koodia.
2. **Saako henkilön ikkuna sanoa Internalissa suoraan "Henkilökohtainen
   tili ei käy" ja silti päästää jatkamaan?** Suositus: kyllä. Jatkaminen
   jää, koska ilmoitus voi olla vanha ja organisaation tili toimii.
3. **Poistetaanko julkaisuvaiheen Testing-oletus ja lisätäänkö
   "Joku ei pääse yhdistämään…" heti, suunnasta riippumatta?**
   Suositus: kyllä. Kumpikaan ei tarvitse uutta host-tietoa.

## Tarkistus

- `capture.spec.ts` (kopioituna hetkeksi `web/tests/`-hakemistoon,
  `scripts/test-focused.sh --area browser`): 3/3 ajoa, 74 kuvaa.
- `build.mjs`: rakentui, ja 74 kaappausta upotettiin WebP-muodossa.
- `check.mjs`: 317 tarkistusta, konsoli puhdas (virheet ja varoitukset
  kaatavat), kaikki suunnat ja tilanteet 1440 vaaleana, 390 vaaleana ja
  1440 tummana, klikatut polut ja valitsimen tarkistus myös 390 px:ssä.
- Katselmointi: itsekatselmointi ruutukaappauksista ja tekstistä. Muutos
  koskee vain prototyyppiä, eikä se muuta tuotantokoodia, sopimusta tai
  valtarajoja.
