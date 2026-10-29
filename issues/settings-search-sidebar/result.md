# Tulos: haku asetuksissa, Sivupalkissa

Asetusten sivupalkin yläreunassa on hakukenttä (`/` kohdistaa). Kun kentässä
on tekstiä, osioluettelo vaihtuu tuloslistaksi (nimi, polku ja tarvittaessa
*osui: …* tai kuvauksen katkelma). Työpöydällä valittu tulos avautuu oikealle
tuotannon rivihypyllä ja merkinnällä, ja osion muut osuvat rivit saavat
hiljaisen reunaviivan (`data-hit`). Nuolet vaihtavat tulosta ja Enter vie
kohdistuksen riville. Esc tyhjentää ensin haun ja sulkee asetukset vasta
tyhjänä. Puhelimessa tulokset korvaavat luettelon, tulos avaa rivin ja
*← Hakutulokset* palaa hakuun.

Hakuindeksi on `web/src/app/settingsIndex.ts`. Siinä ovat kaikki 17 osiota ja
niiden 54 riviä nimineen, ryhmineen, synonyymeineen (suomi ja englanti) ja
lyhyine kuvauksineen. Sivupalkki piirtää osiot samasta taulukosta, ja
`SettingsRow`-tyyppi on taulukon rivitunnisteet. Jokaisella tuotannon
asetusrivillä on `data-settings-row`. Browser-spec `settings-search.spec.ts`
käy ylläpitäjänä jokaisen osion läpi: jokainen indeksin rivi löytyy sivulta
(paitsi `when`-merkityt ehdolliset), eikä sivulla ole indeksistä puuttuvia
rivejä. Tilannekatsauksen rivitunnisteet ovat `recap-settings-levels`-työn
tunnisteet.

## Päätökset myöhempää tarkistusta varten

- **Rivitunnisteet tuotannon rakenteen mukaan, ei prototyypin.** Esimerkiksi
  Sanelussa on yksi rivi (`speech-key`), koska alue ei ole enää oma
  asetuksensa. Palvelinintegraatioiden rivit ovat `server-google` jne. ja
  Tiedot agenteille -rivit palvelun tunnuksia (`google`, `imap`, `caldav`, …).
  Käyttöönotossa on kaksi riviä, vaiheet (`onboarding-route`) ja henkilön
  näkymä (`onboarding-preview`), koska vaiheen asetukset vaihtuvat valitun
  vaiheen mukaan. Vaihtoehto: tunniste jokaiselle vaiheen asetukselle.
  Valinnan syy: ne eivät ole sivulla samaan aikaan, joten niihin ei voi
  hypätä.
- **`#gitea` osuu nyt Gitean omaan riviin**, ei Gitean ja GitLabin yhteiseen
  lohkoon. Uuden työtilan sivun Gitea-virheen linkki merkitsee siksi pelkän
  Gitea-ruudun. Vaihtoehto: säilyttää lohkon tunniste ja lisätä GitLabille
  oma. Valinnan syy: kaksi sisäkkäistä samaa tunnistetta tekisi hypystä
  epäselvän, ja oma rivi on tarkempi.
- **Oman tason luvut (`recap-messages` … `recap-response`) laskeutuvat
  Laajuus-riville**, kun taso ei ole Oma, koska rivit eivät silloin ole
  sivulla (`within` indeksissä). Vaihtoehto: haku vaihtaisi tason Omaksi.
  Valinnan syy: haku ei saa muuttaa asetuksia.
- **Ehdolliset rivit** (`gitea`, `gitlab` kun tea/glab puuttuu, `default-limit`
  kun rajat eivät ole käytössä) näkyvät tuloksissa silti. Valinta avaa osion,
  vaikka riviä ei ole. Vaihtoehto: suodattaa ne pois. Valinnan syy: suodatus
  vaatisi osioiden tietojen lukemista haun aikana, ja osio kertoo itse, miksi
  palvelu puuttuu.
- **Esikatselu korvaa historiamerkinnän** (`replace`), joten selaimen
  Takaisin ei käy läpi jokaista nuolella avattua tulosta. Puhelimessa tulos
  avataan uutena merkintänä, joten Takaisin palaa tuloksiin.
- **Klikkaus tulokseen toimii kuten Enter** (vie kohdistuksen riville).
  Vaihtoehto: klikkaus vain esikatselee (prototyyppi). Valinnan syy:
  hiirellä valittu tulos tarkoittaa yleensä, että asetusta halutaan käyttää,
  ja kohdistus rivillä tekee seuraavasta Tabista ennustettavan.
- **Pisteytys on prototyypin**: nimiosuma voittaa synonyymiosuman myös
  ylläpitäjän rivillä. *avain* näyttää siksi Soniox-avaimen ja sivuston
  AI-avaimen ennen omia API-avaimia, joiden nimi on *API-avaimet*. Omat
  asetukset tulevat ensin vain samanarvoisella osumalla (*soniox*).
- **Rivien tekstiä ei korosteta osion sisällä**, vain tuloslistassa. Osuvat
  rivit saavat reunaviivan. Vaihtoehto: `<mark>` myös rivien nimiin.
  Valinnan syy: rivien tekstit ovat 15 komponentin JSX:ssä, ja korostus olisi
  vaatinut hakusanan viemisen jokaiseen.
- **`/` tunnistetaan merkkinä (`event.key`)**, ei näppäinkoodina, koska
  suomalaisella näppäimistöllä se on Shift+7. Kuolleita näppäimiä ei tarvita.
