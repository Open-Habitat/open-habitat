# Apple (iCloud) omana integraationaan

**[Avaa kierros](https://glasspad.example.test/p/tmowd4bw2cp2ea2wuahcoyaqxm/).** Valitse suunta alareunasta (myös näppäimet 1–3 ja nuolet). Yläreunan *Esimerkkihenkilö* vaihtaa tilanteiden *Ei yhdistetty*, *Vain yhteystiedot* (kuten sinulla nyt: yleinen CardDAV-liitos `contacts.icloud.com`) ja *Salasana mitätöity* välillä. Kaikki tiedot ovat keksittyjä. Kokeile Apple ID:llä `aino.virtanen@icloud.com` tai `aino@virtanen.example`. Salasana `abcd-efgh-ijkl-mnop` hyväksytään, ja muu salasana hylätään kuten Apple hylkäisi Apple-tilin oman salasanan.

Asetukset › Integraatiot saa ruudun **Apple (iCloud)**. Yksi Apple ID ja yksi sovellussalasana yhdistävät iCloud Mailin (IMAP/SMTP), kalenterin (CalDAV) ja yhteystiedot (CardDAV). Ohje on Vaiheittain-muodossa kuten Googlen ylläpitäjäohjeessa: ensin *Sovellussalasana* (account.apple.com › Sign-In and Security › App-Specific Passwords › Generate an app-specific password, nimeksi *Open Habitat*), sitten *Tunnukset*. *Minulla on jo sovellussalasana* hyppää suoraan kenttiin. Yleiset IMAP-, CalDAV- ja CardDAV-ruudut jäävät otsikon *Muut palvelut* alle muita palveluntarjoajia varten.

## Akseli ja suunnat

Akseli on se, **kuinka paljon yksi Apple-liitos niputtaa**. Ohje, kentät ja Applen vaiheet ovat kaikissa suunnissa samat.

1. **Kaikki kerralla.** Kaksi vaihetta. Yhdistä yrittää kaikkia kolmea palvelua, ja lopuksi näkyy, mikä onnistui. Integraatioissa on yksi Apple-kortti, jossa ovat kaikki kolme palvelua. Kun Apple mitätöi salasanan, kortissa on yksi *Anna uusi salasana*, ja se korjaa kaikki kolme. Jos Apple ID ei ole iCloud-osoite, lomake kysyy lisäksi iCloud Mail -osoitteen. Jos kenttä jää tyhjäksi, posti jää pois ja kortti tarjoaa *Yhdistä samalla salasanalla…*. Yleinen CardDAV-liitos iCloudiin, kuten sinun nykyinen, siirtyy tähän korttiin. Ratkaisee: vähiten valintoja, ja yksi korjaus kun salasana vanhenee.
2. **Valitse palvelut.** Sama kortti, mutta ohjeen ensimmäinen vaihe on *Palvelut* (kolme valintaruutua, kaikki valittuina). Jos posti on valittu, iCloud Mail -osoite on pakollinen. Puuttuvat palvelut lisätään myöhemmin kortin *Lisää palvelu…* -painikkeella. Ratkaisee: ihminen päättää etukäteen, mitä agentti näkee. Hinta on yksi vaihe lisää jokaiselle.
3. **Yleiset kortit.** Apple-ruutu on pelkkä ohje. Se tekee kolme tavallista korttia: *Sähköposti (IMAP)*, *Kalenteri (CalDAV)* ja *Yhteystiedot (CardDAV)*. Mitään uutta korttityyppiä ei synny, mutta kun salasana mitätöidään, korjaus tehdään kolmesti, eikä kortista näe, että se on iCloud.

## Suositus

**Kaikki kerralla.** Applen sovellussalasana on yksi koko tilille, ja Apple mitätöi kaikki sovellussalasanat kerralla, kun Apple-tilin salasana vaihdetaan. Siksi yksi kortti ja yksi korjaus vastaavat sitä, miten Apple oikeasti toimii. Palveluvalinta (suunta 2) lisää kaikille vaiheen, jota harva tarvitsee. Postin voi jättää pois jättämällä iCloud Mail -osoitteen tyhjäksi, ja kortin *Poista…* poistaa kaiken. Suunta 3 on halvin rakentaa, mutta se jättää salasanan vanhenemisen kolmeksi erilliseksi ongelmaksi.

Apple-korttia varten ei tarvita uutta tietovarastoa. Daemon tallentaa jo nyt kolme tavallista tiliä (`imap`, `caldav`, `carddav`), ja kortti kootaan niistä tallennetun palvelimen perusteella (`imap.mail.me.com`, `*.icloud.com`). Siksi myös sinun nykyinen CardDAV-liitoksesi näkyy suoraan Apple-kortissa.

## Mitä näkymät olettavat hostilta

- **Applen ohje ja asetukset** (tarkistettu 24.10.2026):
  - Sovellussalasana: [Sign in to apps with your Apple Account using app-specific passwords](https://support.apple.com/en-us/102654). Ohjeen mukaan: kirjaudu account.apple.comiin, valitse *Sign-In and Security* › *App-Specific Passwords*, sitten *Generate an app-specific password*. Toiminto vaatii kaksivaiheisen tunnistuksen. Aktiivisia salasanoja voi olla enintään 25. Kaikki sovellussalasanat mitätöityvät, kun Apple-tilin salasana vaihdetaan tai nollataan. Salasanan poistaa samassa paikassa (*Remove* tai *Revoke All*).
  - Postin palvelinasetukset: [iCloud Mail server settings for other email client apps](https://support.apple.com/en-us/102525). IMAP on `imap.mail.me.com:993` SSL:llä, ja käyttäjätunnus on *osoitteen nimiosa* (`johnappleseed`, ei `johnappleseed@icloud.com`). SMTP on `smtp.mail.me.com:587`, ja käyttäjätunnus on *koko iCloud-osoite*. Oman verkkotunnuksen osoitteilla kirjaudutaan silti ensisijaisella @icloud.com-osoitteella ([Use Custom Email Domain with iCloud Mail](https://support.apple.com/en-gb/102540)).
  - Salasanan muoto `xxxx-xxxx-xxxx-xxxx` on Applen sivun näyttämä muoto, mutta tukiohje ei mainitse sitä. Siksi se on lomakkeessa vain vihje ja varoitus (*Ei näytä sovellussalasanalta*), ei estävä sääntö.
- **IMAP- ja SMTP-tunnus eroavat.** Tämä on tuotannon puute. Nykyinen himalaya-asetus käyttää samaa `username`-arvoa sekä IMAP:lle että SMTP:lle (`himalaya_linux.go`). iCloudin kanssa tarvitaan erillinen SMTP-käyttäjätunnus, tai sitten koko osoitteen kelpaaminen IMAP:iin on varmistettava oikealla tilillä. Kierros olettaa erillisen tunnuksen.
- **Apple ID ja iCloud Mail -osoite** voivat olla eri osoitteita. CalDAV ja CardDAV kirjautuvat Apple ID:llä, posti iCloud-osoitteella. Lomake kysyy osoitetta vain, jos Apple ID ei ole @icloud.com-, @me.com- tai @mac.com-osoite.
- **Yksi yhdistäminen, kolme tiliä.** Host yhdistää palvelut erikseen ja tallentaa ne, jotka onnistuivat. Jos Apple hylkää salasanan, mitään ei tallenneta. Jos vain posti epäonnistuu, kalenteri ja yhteystiedot jäävät voimaan ja tuloslistassa lukee syy. Kalenterin ja yhteystietojen osoite haetaan nykyisellä DAV-haulla (`dav-icloud-discovery`). Tuloslistassa näkyy löydetty `pNN-…icloud.com`.
- **Palvelun lisääminen samalla salasanalla** (suunnat 1 ja 2) lukee salasanan henkilön omista himalaya- tai curl-asetuksista. Daemon on sama Unix-käyttäjä, joten raja ei muutu, mutta tämä on uusi lukupolku. Vaihtoehto on kysyä salasana uudelleen.
- **Uusi salasana kaikille** vaihtaa saman salasanan kaikkien kolmen tilin asetuksiin. Nykyinen uusiminen tarkistaa jokaisen tilin tallennetun osoitteen erikseen.

## Kysymykset Jarille

1. Kaikki kerralla (suositus) vai Valitse palvelut?
2. Saako *Yhdistä samalla salasanalla* lukea tallennetun sovellussalasanan, vai kysytäänkö se uudelleen?
3. Tuleeko Applesta myös käyttöönoton integraatiovaihe kuten Googlesta? Sen voi lisätä samalla mallilla, kun kortti on toteutettu. Tällä kierroksella vaihetta ei rakennettu.
4. Siirretäänkö yleisen CalDAV/CardDAV-lomakkeen iCloud-esimerkki pois? Nykyään lomake neuvoo iCloud-osoitteet. Apple-ruudun kanssa lomake voisi sanoa vain "iCloudille käytä Apple-ruutua".

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-10-24-apple-icloud/build.mjs [kansio]   # {index,offline}.html
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-24-apple-icloud/check.mjs <html-tai-url> <kuvakansio>
```

`check.mjs` käy läpi kolme suuntaa 1440 ja 390 px leveydellä, vaaleana ja tummana. Se klikkaa ohjeen läpi, kokeilee hylätyn salasanan, puuttuvan iCloud-osoitteen, palvelun lisäämisen, mitätöidyn salasanan uusimisen, poiston ja yleisen CardDAV-liitoksen iCloudiin (se siirtyy Apple-korttiin). Lopuksi se tarkistaa, että konsoli on puhdas. Tulos oli 36 tarkistuspistettä sekä paikallisessa tiedostossa että julkaistulla sivulla (`ap-checks.json`, `ap-hosted-checks.json`). Tuotannon komponentit: `AccountCard`, `AgentWarning`, `ConnectDialog` (yleiset lomakkeet), `RemoveDialog`, `ProviderMark`, `ControlButton`, `Segmented`, `TextField`, `Checkbox` sekä `Integrations.css`. Kierroksen omia ovat Apple-kortti, ohje ja synteettinen Apple. Glasspadin hiekkalaatikko estää lomakkeiden natiivin lähetyksen, joten kierros välittää tuotantolomakkeen submit-tapahtuman itse (`submitInSandbox`).
