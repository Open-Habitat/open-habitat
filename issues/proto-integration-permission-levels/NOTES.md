# Integraation oikeustaso – opas kokeiluun

Kierros näyttää, miten valitset tiliä yhdistäessäsi, mitä agentit saavat
tehdä tilillä, ja miten taso näkyy jälkikäteen sivulla Asetukset › Tiedot
agenteille. Tasot ovat palveluiden todellisia vaihtoehtoja selvityksestä
`research-integration-permission-scopes`. Kaikki on synteettistä:
kirjautumissivut ovat katkoviivaisia sijaisia, eikä mitään lähetetä.

Avaa `issues/proto-integration-permission-levels/prototype/index.html`
selaimessa. Se on yksi offline-tiedosto. Ruudun alareunan valitsimesta tai
näppäimillä 1–3 ja ←/→ vaihdat suuntaa. Yläpalkin **Tilanne** vaihtaa
lähtötilanteen ja **Tumma** teeman. Puhelinnäkymän saat kaventamalla ikkunan
alle 760 px:n.

## Akseli

Suunnat eroavat siinä, **kuka päättää oikeuksista ja kuinka tarkasti**:

1. **Tilitaso**: valitset tilille yhden tason, esimerkiksi *Täysi*,
   *Luonnokset, ei lähetystä* tai *Vain luku*.
2. **Palveluittain**: valitset tason erikseen postille, kalenterille ja
   tiedostoille.
3. **Myönnöstä**: Habitat ei kysy mitään. Se pyytää kaiken, ja rajaus
   tehdään palvelun omalla kirjautumissivulla tai organisaation hallinnassa.
   Habitat näyttää, mitä myönnettiin.

Kaikissa kolmessa ovat samat:

- sivun yläosan huomautus siitä, mitä taso ei estä
- tilanne, jossa organisaatio on rajannut oikeuksia
- tason vaihtaminen myöhemmin uudella kirjautumisella
- *Myönnetyt oikeudet* -luettelo palvelun omin nimin, kuten `Mail.ReadWrite`

## Mitä kokeilet

1. **Tilit yhdistetty**: lue sivu ylhäältä alas. Näetkö yhdellä
   silmäyksellä, mitä agentit voivat kullakin tilillä tehdä?
2. Paina Googlen kortissa **Vaihda taso…** (suunnassa 3 **Muuta
   oikeuksia…**). Katso, mitä vaihdosta kerrotaan: uusi kirjautuminen,
   vanhan kirjautumisen peruminen ja Driven synkronoinnin suunta.
3. Valitse **Ei vielä tilejä** ja yhdistä Microsoft 365, Google, Dropbox ja
   IMAP. Katso, miten Gmailin puuttuva luonnostaso on kerrottu.
4. Valitse **Organisaatio ja palvelin rajaavat**. Konepaja Oy:n Microsoft
   on myöntänyt vähemmän kuin pyydettiin, ja Osuuskunta Ruis on estänyt
   Gmailin. IMAP-tilillä lähetystä ei ole määritetty, mutta salasana kelpaa
   silti lähetykseen. Yhdistä sitten Microsoft. Palvelimella on vain Täysi-tason
   sovellus, joten muut tasot ovat harmaina, ja tulos kertoo, mitä organisaatio
   rajasi.
5. Kokeile samoja asioita puhelimessa ja tummana.

## 1 · Tilitaso (suositus)

Yhdistämisikkunassa on tasot kortteina. Valitun kortin alla lukee
palveluittain, mitä agentit saavat tehdä. Jos palvelu ei tarjoa tasoa, kortti
näkyy harmaana ja syy kerrotaan. Esimerkiksi Gmailin luonnosoikeus antaa
aina myös lähetysoikeuden. Microsoftilla voi lisäksi rajata tiedostot
valittuihin kansioihin.

![Tilitaso: Microsoftin tasot](screenshots/a-yhdista-microsoft-1440-light.avif)
![Tilitaso: Google, luonnostasoa ei ole](screenshots/a-yhdista-google-1440-light.avif)
![Tilitaso: Dropbox](screenshots/a-yhdista-dropbox-1440-light.avif)
![Tilitaso: IMAP, raja on aito vain jos salasana ei kelpaa lähetykseen](screenshots/a-yhdista-imap-1440-light.avif)

Kirjautumisen jälkeen kortin otsikossa on tason nimi, ja jokaisen palvelun
rivillä lukee, mitä se sallii. Punasävyinen merkki tarkoittaa täyttä tasoa,
sinertävä kavennettua.

![Tilitaso: sivu](screenshots/a-sivu-1440-light.avif)
![Tilitaso: sivu tummana](screenshots/a-sivu-1440-dark.avif)
![Tilitaso: puhelin](screenshots/a-sivu-390-light.avif)
![Tilitaso: kirjautumissivu (sijainen)](screenshots/a-kirjautuminen-microsoft-1440-light.avif)
![Tilitaso: yhdistetty](screenshots/a-yhdistetty-microsoft-1440-light.avif)
![Tilitaso: uudet tilit sivulla](screenshots/a-uudet-tilit-1440-light.avif)

Tason vaihto avaa saman ikkunan. Siinä näkyy nykyinen ja uusi taso sekä
vaihdon seuraukset.

![Tilitaso: Google vain luku → täysi](screenshots/a-vaihda-google-1440-light.avif)
![Tilitaso: Microsoft luonnokset → täysi](screenshots/a-vaihda-microsoft-1440-light.avif)

Kun organisaatio on rajannut oikeuksia, kortissa kerrotaan kuka rajasi ja mitä
puuttuu. Tasoksi näytetään se, mitä oikeasti myönnettiin.

![Tilitaso: organisaatio rajannut](screenshots/a-rajattu-1440-light.avif)
![Tilitaso: palvelimella vain täysi taso](screenshots/a-rajattu-yhdista-microsoft-1440-light.avif)
![Tilitaso: yhdistetty kapeammin](screenshots/a-rajattu-yhdistetty-1440-light.avif)
![Tilitaso: rajattu, puhelin tummana](screenshots/a-rajattu-390-dark.avif)
![Tilitaso: Dropbox puhelimessa](screenshots/a-yhdista-dropbox-390-dark.avif)

## 2 · Palveluittain

Jokaisella palvelulla on oma valitsimensa. Googlella posti, kalenteri,
yhteystiedot ja Drive valitaan erikseen. Microsoftilla tason voi valita vain
postille, ja muut palvelut seuraavat sitä. Ikkuna kertoo syyn: Microsoft antaa
yhdelle sovellukselle saman oikeusjoukon kaikille käyttäjille. Taso näkyy
jälkikäteen jokaisella palvelurivillä.

![Palveluittain: Google](screenshots/b-yhdista-google-1440-light.avif)
![Palveluittain: Microsoft](screenshots/b-yhdista-microsoft-1440-light.avif)
![Palveluittain: sivu](screenshots/b-sivu-1440-light.avif)
![Palveluittain: tummana](screenshots/b-sivu-1440-dark.avif)
![Palveluittain: puhelin](screenshots/b-sivu-390-light.avif)
![Palveluittain: vaihto](screenshots/b-vaihda-google-1440-light.avif)
![Palveluittain: rajattu](screenshots/b-rajattu-1440-light.avif)
![Palveluittain: Dropbox puhelimessa](screenshots/b-yhdista-dropbox-390-dark.avif)

## 3 · Myönnöstä

Habitat pyytää kaiken ja kertoo, voiko palvelun sivulla rajata. Googlen
sivulla voi jättää palvelun kokonaan pois, mutta Gmailia ei voi vaihtaa
pelkkään lukuun. Microsoftilla ja Dropboxilla henkilö ei voi valita mitään.
Kortti näyttää jälkikäteen jokaisesta palvelusta, mitä myönnettiin
(✓ Lukee, ✗ Lähettää). Tilanteessa *Tilit yhdistetty* Gmail on jätetty
Googlen sivulla myöntämättä.

![Myönnöstä: yhdistäminen](screenshots/c-yhdista-google-1440-light.avif)
![Myönnöstä: Googlen sivu, Gmail jätetään pois](screenshots/c-kirjautuminen-google-1440-light.avif)
![Myönnöstä: sivu](screenshots/c-sivu-1440-light.avif)
![Myönnöstä: tummana](screenshots/c-sivu-1440-dark.avif)
![Myönnöstä: puhelin](screenshots/c-sivu-390-light.avif)
![Myönnöstä: muuta oikeuksia](screenshots/c-vaihda-google-1440-light.avif)
![Myönnöstä: rajattu](screenshots/c-rajattu-1440-light.avif)
![Myönnöstä: Microsoft puhelimessa](screenshots/c-yhdista-microsoft-390-dark.avif)

## Mitä kysyn sinulta

- **Tilitaso, Palveluittain vai Myönnöstä?** Suosittelen Tilitasoa.
  Jokainen sen taso on raja, jota palvelu itse valvoo, ja se on yhtä helppo
  kaikilla palveluilla. Perustelut ovat [result.md](result.md):ssä.
- **Luonnokset, ei lähetystä: kalenteri ja tiedostot vain luku?**
  Prototyypissä taso lupaa, ettei tililtä lähde mitään: ei postia,
  kalenterikutsuja eikä jakolinkkejä. Sen vuoksi kalenteri ja tiedostot ovat
  silloin vain luku.
- **Peruuko tason vaihto vanhan kirjautumisen palvelussa?** Prototyypissä
  peruu (Google ja Dropbox). Nyt tuotanto ei peru edes poistettaessa.
