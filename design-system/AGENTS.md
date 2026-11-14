# Agent Host UI

Tämä hakemisto on käyttöliittymän yhteinen visuaalinen perusta: tokenit, niiden
käyttöä näyttävät ohjekortit, paketoidut fontit sekä designin kuvaus ja
komponenttikartta. Tuotantokomponentit itse ovat
`web/src/components/`-hakemistossa; tämä hakemisto kertoo, miltä niiden pitää
näyttää ja mitä ne saavat omistaa. Selainsovelluksen tila- ja turvarajat ovat
`web/AGENTS.md`:ssä.

## Mistä tieto löytyy

[design.md](design.md) kuvaa nykyisen designin ja [drafts/](drafts/) näyttää
sen näkymät; [prototypes/](prototypes/) on `/prototype`-kierrosten kirjasto,
josta keskustelunäkymän vedos rakennetaan. Tuotantokomponentit ja niiden
Storybook-esimerkit ovat `web/src/components/`-hakemistossa, propsit
määritellään komponenttien lähdekoodissa, ja `contracts/v1/` kertoo hostin
tarjoaman tiedon ja komennot.

Designia päivitetään samoihin tiedostoihin. Korvatut vedokset ja ohjeet jäävät
Git-historiaan, jotta nykyisessä puussa ja designerille lähtevässä paketissa on
yksi suunnittelukohde. `docs/product.md` kuvaa käyttökulut ja `TESTING.md`
katalogin avaamisen.

## Päätökset, joita ei tehdä uudestaan koodissa

Nämä on päätetty Jarin kanssa katselmoinneissa. Niiden muuttaminen on hänen
päätöksensä, ei toteutuksen sivutuote.

Ensimmäinen versio on työpöytäsovellus, ja puhelinleveys pidetään mukana.

Käyttöliittymä on suomeksi. Tekniset tunnisteet, kuten polut, komennot,
exit-koodit, resume-ID:t sekä workspacejen ja agenttien nimet, näytetään
sellaisinaan monospacella. Käyttäjä kopioi ne terminaaliin ja vertaa niitä
natiivilähteisiin, joten käännetty tai toiseksi muutettu tunniste katkaisee
yhteyden siihen, mitä host oikeasti tietää.

Kolme teemaa ovat yhtä tuettuja: Päivä (`data-theme="light"`), Yö
(`data-theme="dark"`) ja Korkea kontrasti (`data-theme="contrast"`, tumma), kaikki
`tokens/colors.css`:ssä. Järjestelmä-valinta seuraa `prefers-color-scheme`a ja
valitsee Korkean kontrastin, kun laite pyytää `prefers-contrast: more`. Teema on
laitteen esitysvalinta eikä kuulu host-snapshotiin, koska snapshot kuvaa natiivia
tilaa eikä selaimen asetuksia.

Komponenttikirjastoa kasvatetaan, kun hyväksytty journey tarvitsee jotakin, ei
varalta. Sama periaate koskee koko tuotetta: varalta tehty layout-, tooltip- tai
taulukkokirjasto on ylläpidettävää pintaa ilman käyttäjää.

Visuaalinen komponentti saa valmiin näyttömallin ja palauttaa käyttäjän intentin.
Se ei avaa verkkoa, muodosta command ID:tä, sovita snapshotia ja SSE-tapahtumia,
päättele Pi-capabilityä eikä tallenna luonnosta; nämä omistaa sovelluskerros
`web/AGENTS.md`:n tilanomistuksen mukaan. Jos komponentti päättelisi host-tilaa itse,
sovelluksessa olisi kaksi käsitystä siitä, mitä agentti tekee, ja ne eroaisivat
juuri katkosten aikana, kun rehellisyys on tärkeintä.

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
palvelimelta. Kokonaiset näkymät kootaan tuotantokomponenteista synteettisessä labissa.

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
hyväksyttyyn suunnitelmaan eivätkä tänne yleisiksi säännöiksi. Yhden näkymän ratkaisu ei sellaisenaan ole kaikkien näkymien sääntö.

## Komponentit ja Storybook

Sovellus, Storybook ja testien deterministinen preview tuovat samat
TypeScript-moduulit `web/src/components/`-hakemistosta. Story näyttää oikean
komponentin tilat valmiilla fixturella; jos storyyn rakennetaan oma kontrolli tai
logiikka, katalogi todistaa jonkin muun kuin tuotannon toimivuuden. Katalogi näyttää komponenttien olennaiset tilat, ja `web/AGENTS.md` sekä
`TESTING.md` kertovat, millä komennoilla se tarkistetaan.

Visual evidence is a paired synthetic-lab screenshot and offline static HTML
snapshot stored side by side in the issue folder (see `web/AGENTS.md`).
