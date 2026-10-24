# Tulos: Apple (iCloud) -integraatio

Toteutettu Jarin valitsemana suuntana *Valitse palvelut*. Asetukset ›
Integraatiot saa *Apple (iCloud)* -ruudun ja -kortin. Yleiset IMAP-, CalDAV- ja
CardDAV-ruudut ovat otsikon *Muut palvelut* alla ennallaan. Apple on myös
käyttöönoton integraatiovaihe. Ylläpitäjä lisää sen Käyttöönotto-välilehdellä,
ja se näkyy henkilölle vain, kun himalaya ja curl ovat asennettuina.

## Miten se toimii

- Kortti kootaan daemonin tavallisista `imap`-, `caldav`- ja `carddav`-tileistä
  niiden tallennetun palvelimen perusteella. DAV-tili kuuluu Applelle, kun sen
  URL on samassa rekisteröitävässä verkkotunnuksessa kuin `caldav.icloud.com`
  (eli `*.icloud.com`). Postitili kuuluu Applelle, kun sen IMAP-palvelin on
  `imap.mail.me.com`. Listan tilit saavat kentän `apple_id`. Uutta tietovarastoa
  ei ole. Siksi myös yleisellä lomakkeella tehty iCloud-liitos näkyy kortissa.
- *Lisää palvelu…* ei lähetä salasanaa. Daemon lukee sen saman Apple ID:n
  tallennetusta tilistä henkilön omista himalaya- tai curl-asetuksista ja
  lähettää sen vain Applen kiinteisiin osoitteisiin. Lähteeksi kelpaa vain tili,
  jonka oma palvelin on Applen. Jos tallennettu salasana ei kelpaa, ohje kysyy
  uuden.
- *Anna uusi salasana* vaihtaa saman salasanan Apple ID:n kaikkiin tileihin.
  Jokainen tili tarkistaa salasanan ennen kuin korvaa vanhan.
- *Poista…* poistaa Apple ID:n kaikki tilit. Sovellussalasana jää voimaan
  Applella, ja dialogi kertoo, mistä sen voi poistaa.
- Applen ohjeen mukaisesti IMAP kirjautuu osoitteen nimiosalla ja SMTP koko
  osoitteella (`smtp.mail.me.com:587`, STARTTLS). Himalayan asetukseen tulee
  siksi erillinen SMTP-käyttäjätunnus. Jos nimiosa ei kelpaa IMAP:iin, daemon
  yrittää kerran koko osoitteella, kuten Applen ohje neuvoo.

## Tarkistukset

- `go test ./internal/daemon/integrations`: synteettinen iCloud-DAV (TLS,
  partitio-ohjaus) aidolla curlilla, Applen isännät testipalvelimille siirrettynä.
  Mukana ovat palveluvalinta, hylätty salasana (mitään ei tallennu), lisäys
  tallennetulla salasanalla, Nextcloud-tili samalla tunnuksella (ei lähde),
  uusiminen ja poisto. `OH_TEST_HIMALAYA` asetettuna sama ajetaan pinnatulla
  himalaya 2.2.1:llä synteettistä IMAP/SMTP-palvelinta vasten (nimiosa ja
  koko osoite). Ajettu tämän työn aikana: läpi.
- Selaintesti `integrations-apple.spec.ts` (palvelujen valinta, lisäys samalla
  salasanalla ilman salasanaa pyynnössä, poisto, käyttöönoton Apple-vaihe) ja
  komponenttitestit `AppleIntegration.test.tsx`. Storybookissa
  `Production/Integraatiot/Apple`.

## Päätökset myöhempää tarkistusta varten

- **Apple ID postitilissä.** Jos Apple ID ei ole iCloud-osoite, postitili
  nimetään iCloud Mail -osoitteella. Apple ID merkitään himalaya-tiedoston
  kommenttiriviin `# Apple ID: …`, jotta posti näkyy samassa kortissa. Kommentti
  on tiedoston oma nimilappu, ei erillinen varasto.
- **Oman verkkotunnuksen osoite.** Lähettäjäksi tulee @icloud.com-osoite, koska
  Apple kirjauttaa senkin kautta. Oman verkkotunnuksen lähettäjäosoitetta ei
  kysytä.
- **Osittainen onnistuminen.** Jos Apple hylkää salasanan ensimmäisessä
  palvelussa, mitään ei tallenneta. Myöhemmin epäonnistunut palvelu näkyy
  tuloslistassa syineen, ja onnistuneet jäävät voimaan, kuten kierros oletti.
- **Ei *Kaikki kerralla* -oikotietä.** Kaikki kolme palvelua ovat oletuksena
  valittuina, joten valinta maksaa yhden *Seuraava*-painalluksen.
- **Usea Apple ID.** Jokaiselle Apple ID:lle tulee oma kortti. *Lisää toinen
  Apple ID* avaa saman ohjeen.
- **Agentin oma reitti.** Daemonin oma-UID-reitti (`AgentHandler`) hyväksyy
  samat Apple-pyynnöt, koska se jakaa tilipyyntöjen käsittelijän. Se on sama
  Unix-käyttäjä, joten raja ei muutu.
