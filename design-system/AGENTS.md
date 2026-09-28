# Agent Host UI

Tämä hakemisto on käyttöliittymän yhteinen visuaalinen perusta: tokenit, niiden
käyttöä näyttävät ohjekortit, paketoidut fontit sekä tuotantodesignin ja
komponenttikatalogin määrittelyt. Tuotantokomponentit itse ovat
`web/src/components/`-hakemistossa; tämä hakemisto kertoo, miltä niiden pitää
näyttää ja mitä ne saavat omistaa. Tuotteen arkkitehtuuri on `docs/architecture.md`:ssä
ja selainsovelluksen tila- ja turvarajat `web/AGENTS.md`:ssä.

## Mistä tieto löytyy

[`production-v1.md`](production-v1.md) on tuotantodesignin kanoninen määrittely.
Se sovittaa kaksi vastaanotettua designtoimitusta yhdeksi ratkaisuksi ja päättää
teemat, reitit, fokuksen, streamingin, tilojen sanaston ja journeyt.
[`component-catalog-v1.md`](component-catalog-v1.md) on tuotantokomponenttien
julkinen sopimus: propsit, tapahtumat, tilat ja pakolliset story-esimerkit. Kun
nämä ja koneellinen host-sopimus `contracts/v1/` ovat eri mieltä, tuotantodesign
ratkaisee ulkoasun ja vuorovaikutuksen ja host-sopimus sen, mitä tietoa ja
komentoja on saatavilla. Ajettava katalogi käynnistyy komennolla
`npm run storybook --prefix ../web -- --no-open`; `docs/design-system.md` kuvaa
sen ryhmät ja tarkistuskomennot.

Päätösten perustelut ovat issueissa. [`issues/receive-designer-v1/review.md`](../issues/receive-designer-v1/review.md)
kirjaa toimitusten alkuperät ja Jarin hyväksymän suunnan,
[`issues/review-ui-v1/review.md`](../issues/review-ui-v1/review.md) hyväksytyt
UI-päätökset. Alkuperäiset vedokset ja klikattavat simulaatiot ovat
[`issues/receive-designer-v1/design/`](../issues/receive-designer-v1/design/)-hakemistossa
muuttumattomana evidenssinä, jonka checksumit on kirjattu. Ne ovat hyviä
sommittelureferenssejä, mutta niiden ehdottamat rajapinnat eivät ole sopimus:
yksittäisen jonorivin peruminen, kiinteä otsikon uudelleengenerointirytmi ja vain
hoverissa näkyvä tieto korjattiin tuotantodesignissa tietoisesti. Samasta syystä
vanhat `design-system/components/`-mockit poistettiin, kun ajettava katalogi
korvasi ne.

## Päätökset, joita ei tehdä uudestaan koodissa

Nämä on päätetty Jarin kanssa katselmoinneissa. Niiden muuttaminen on hänen
päätöksensä, ei toteutuksen sivutuote.

Ensimmäinen versio on työpöytäsovellus. Mobiilinäkymiä ei suunnitella eikä
toteuteta ennen kuin työpöytäversio toimii, koska ne kaksinkertaistaisivat joka
näkymän työn ennen kuin yksikään on valmis.

Käyttöliittymä on suomeksi. Tekniset tunnisteet, kuten polut, komennot,
exit-koodit, resume-ID:t sekä workspacejen ja agenttien nimet, näytetään
sellaisinaan monospacella. Käyttäjä kopioi ne terminaaliin ja vertaa niitä
natiivilähteisiin, joten käännetty tai toiseksi muutettu tunniste katkaisee
yhteyden siihen, mitä host oikeasti tietää.

Vaalea ja tumma teema ovat yhtä tuettuja. Oletus seuraa `prefers-color-scheme`a,
ja `tokens/colors.css` toteuttaa tumman `data-theme="dark"`-attribuutilla. Teema on
laitteen esitysvalinta eikä kuulu host-snapshotiin, koska snapshot kuvaa natiivia
tilaa eikä selaimen asetuksia.

Komponenttikirjastoa kasvatetaan, kun hyväksytty journey tarvitsee jotakin, ei
varalta. Sama periaate koskee koko tuotetta: varalta tehty layout-, tooltip- tai
taulukkokirjasto on ylläpidettävää pintaa ilman käyttäjää.

Visuaalinen komponentti saa valmiin näyttömallin ja palauttaa käyttäjän intentin.
Se ei avaa verkkoa, muodosta command ID:tä, sovita snapshotia ja SSE-tapahtumia,
päättele Pi-capabilityä eikä tallenna luonnosta; nämä omistaa sovelluskerros ADR
0002:n tilanomistustaulukon mukaan. Jos komponentti päättelisi host-tilaa itse,
sovelluksessa olisi kaksi käsitystä siitä, mitä agentti tekee, ja ne eroaisivat
juuri katkosten aikana, kun rehellisyys on tärkeintä. Tarkka lista komponentin
paikallisesta tilasta on tuotantodesignin osiossa "Rajaus ja omistajuus".

## Tokenit, ohjekortit ja fontit

`styles.css` on ainoa linkitettävä sisääntulo, ja se tuo `tokens/`-hakemiston
värit, typografian, välit ja liikkeen. Sovellus (`web/src/main.tsx`) ja Storybook
(`web/.storybook/preview.ts`) tuovat sen jo. Arvoja ei toisteta näkymäkohtaisessa
koodissa eikä ohjeteksteissä: kova väriarvo ei seuraa teeman vaihtoa, ja kopio
ohjeessa vanhenee ensimmäisellä tokenimuutoksella. Kun näkymä tarvitsee jotain,
mitä tokeneista ei löydy, lisää tai korjaa token sen sijaan, että teet näkymään
poikkeuksen; poikkeukset kertyvät ja design system lakkaa olemasta lähde. Sama
pätee, jos `guidelines/`-kortti ja token ovat ristiriidassa.

`guidelines/` on staattisia HTML-kortteja, jotka linkittävät `styles.css`-tiedoston
ja näyttävät tokenien tarkoitetun käytön, tilamerkinnät ja saavutettavuuden
perustason; ne avautuvat suoraan selaimessa. `fonts/` sisältää paketoidut
Instrument Sans- ja JetBrains Mono -fontit, ja `fonts/AGENTS.md` kertoo niiden
lisenssit ja alkuperän. Tuotanto ei lataa fontteja kolmannen osapuolen
palvelimelta. `ui_kits/conversation/` on yksi staattinen koostamisesimerkki, ei
tuotevaatimus.

## Mitä kaikki näkymät sanovat käyttäjälle

Selain on natiivin tilan katselija, ei sen omistaja, ja moni tila on aidosti
epävarma: yhteys katkeaa, lähde puuttuu, adapteri ei kerro. Tuntematon,
vanhentunut tai osittainen tila kerrotaan sellaisenaan eikä päätellä valmiiksi tai
pysähtyneeksi, koska käyttäjä tekee sen perusteella päätöksiä oikeista
prosesseista. Estetyn toiminnon yhteydessä näkyy syy, jotta käyttäjä tietää,
odottaako hän vai korjaako jotain. Olennainen tieto ei ole pelkästään värissä,
tooltipissä tai hoverissa, koska näppäimistö, ruudunlukija, 200 %:n zoom ja
värinäön puutteet eivät tavoita niitä; `guidelines/states.html` näyttää
järjestyksen merkki, sana, väri. Kieli on rauhallista ja suoraa ilman
huutomerkkejä, emojeja tai kehumista. Tilojen tarkka sanasto ja siirtymäsäännöt
ovat tuotantodesignissa.

Näkymäkohtaiset ratkaisut, kuten otsikoiden generointi, polkujen lyhentäminen,
puhujatunnisteet, jonon esitys ja ohjaustoiminnot, kuuluvat kyseisen näkymän
hyväksyttyyn suunnitelmaan eivätkä tänne yleisiksi säännöiksi. Ensimmäinen
designtoimitus ehdotti useita tällaisia, ja osa hylättiin katselmoinnissa. Design
systemin yleissääntönä hylätty päätös tulisi takaoven kautta voimaan kaikissa
näkymissä.

## Komponentit ja Storybook

Sovellus, Storybook ja testien deterministinen preview tuovat samat
TypeScript-moduulit `web/src/components/`-hakemistosta. Story näyttää oikean
komponentin tilat valmiilla fixturella; jos storyyn rakennetaan oma kontrolli tai
logiikka, katalogi todistaa jonkin muun kuin tuotannon toimivuuden. Katalogin
sopimus kertoo, mitä komponentin pitää tukea (pitkä suomenkielinen sisältö,
näppäimistö, tumma teema, 200 %:n zoom, reduced motion), ja `web/AGENTS.md` sekä
`docs/design-system.md` kertovat, millä komennoilla se tarkistetaan.
