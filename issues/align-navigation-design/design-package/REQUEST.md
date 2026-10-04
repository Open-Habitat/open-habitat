# Designerin tehtävä: navigaatio ja asetukset

Omega Habitat (Native Agent Host) antaa käyttäjälle selainyhteyden omiin
Linux-palvelimella oleviin työtiloihin ja Pi-agenttikeskusteluihin. Käyttäjä
palaa kesken jääneeseen työhön, vaihtaa työtilaa tai keskustelua ja hallitsee
oman tilinsä asetuksia. Toteutuksen sommittelu on erkaantunut designista:
teknisesti toimivat näkymät eivät vielä muodosta yhtenäistä käyttöliittymää.

Suunnittele navigaation ja asetusten yhteinen sommittelu nykyisten
`design-system/drafts/`-vedosten pohjalta. Näkymät ovat suomeksi,
työpöydällä ja puhelimessa, vaaleana ja tummana. Kierroksen toteutustyöt
ovat `align-navigation-design` ja `align-settings-design`.

## Navigaatio ja työhön palaaminen

Sovita avoin sivupalkki, kapea ikonikaista ja puhelimen navigaatiolaatikko
samaan kokonaisuuteen. Niihin kuuluvat työtila- ja keskustelurivit, Etusivu,
tilipainike ja tilivalikko. Paluunäkymä auttaa jatkamaan työtä käynnissä olevien
ja äskettäin avattujen keskustelujen kautta. Suunnittele myös työtilasivun
vastine: toteutuksen `workspace-*`-näkymälle puuttuu nykyisestä vedoksesta pohja.

Näytä, miten nykyinen sijainti, pitkät nimet ja agentin tila erottuvat ja miten
rivit toimivat valittuina ja näppäimistöfokuksessa. Agentin aktiivisuus ja huomion
tarve ovat eri asioita kuin rivin valinta; käynnissä oleva prosessi ei yksin
kerro agentin työskentelevän. Agenttitilojen merkitykset valmistellaan
`refine-agent-status`-issuessa ja yhteinen esitys `design-control-states`-kierroksella.

Ensimmäinen keskustelun avaus hakee historian. Paluu säilyttää kirjoitusluonnoksen
ja lukukohdan, ja taustapäivitykset säilyttävät fokuksen käyttäjän valitsemassa
paikassa. Esitä näiden tilanteiden tarvitsema palaute osana sommittelua.
Sovittu käyttökulku kuvataan `docs/ui.md`:ssä.

## Asetukset ja tilin tunnistaminen

Sovita Tili-, Yhteydet tällä palvelimella-, Ulkoasu- ja Istunto-osiot navigaation
kanssa samaan käyttöliittymään. Tilipainikkeessa on etunimi ja GitHub-profiilikuva
tai varaesitys; avatussa tilinäkymässä näkyy sähköposti, kun se on saatavilla.
Profiilitiedot ja puuttuvien tietojen käsittely kuuluvat
`account-profile-from-github`-työhön.

Näytä myös puuttuvat profiilitiedot, pitkät tekstit sekä yhteyksien keskeneräiset,
tuntemattomat ja virhetilat. Yhteyden esitys perustuu saatavilla olevaan tietoon:
varmistamaton yhteys näkyy tuntemattomana. OpenAI-yhteysrivin toiminnallisuus
kuuluu `add-account-settings-ui`-työhön; tässä suunnitellaan sen esitys.
Selainuloskirjautuminen päättää selainistunnon, ja palvelimen tunnukset sekä
agenttien työ säilyvät. Asetusten tulee tehdä tämä vaikutus ymmärrettäväksi.

## Yhteinen pohja ja aineisto

Käytä tuotannon yhteisiä kontrolleja (`web/src/components/`) ja
`design-system/tokens/`-arvoja. Näytä näkymien kontrollien olennaiset
vuorovaikutustilat osana suunnitelmaa. Koko kontrollikirjaston ja agenttitilojen
yhteinen tilasuunnittelu kuuluu `design-control-states`-kierrokseen;
tässä tarvittavat täydennykset kirjataan sen lähtötiedoiksi.

Paketin `rendered-pages/index.html` avaa synteettiset HTML-palaset ja kuvat
neljässä esitystavassa: 1440 × 900 ja 390 × 844, molemmissa teemoissa.
Fokusnäkymien kokonaiset sivut ovat `*-full.html`. Navigaation aineisto on
`landing-*`, `workspace-*`, `history-*`, `account-menu-*` ja
`workspace-details-*`; asetusten aineisto on `settings-*` ja
`SettingsDensity.stories.tsx`. Vertailupohjana ovat vedokset
`Selainpolku.dc.html`, `Puhelin.dc.html` ja `Tummat näkymät.dc.html`.
Yhteisten kontrollien käyttöönottoa näyttävät myös
`issues/unify-ui-primitives/`- ja `issues/migrate-bespoke-controls/`-tallenteet.

`MANIFEST.md` kertoo paketin lähdecommitin. Tämä on ensimmäinen
inventaariopaketti, joten `rendered-pages/inventory.json` ja
`rendered-pages/COVERAGE.md` kuvaavat koko tilajoukon ja sen aukot.
Tämän paketin inventaariosta puuttuvat muun muassa avoimen ja kapean
navigaation, puhelinlaatikon, tyhjän suodatustuloksen, puuttuvan profiilin
ja tuntemattoman yhteystilan kattavat tallenteet. Vuorovaikutustilojakaan
ei voi arvioida pelkistä kuvista. Vanhemmat erillistallenteet täydentävät
aineistoa; vanha `review-browser-design-v2/assessment.md` edeltää
kontrollimigraatiota. Kaappausten tiedot ovat keksittyjä labiesimerkkejä.

## Odotettu palautus

Toimita muokattavat HTML/CSS-näkymät nykyiseen vedossarjaan. Yhdistä ehdotukset
inventaarion tiloihin, perustele olennaiset muutokset ja kerro, mitä ne muuttavat
tuotannon komponenteissa tai tokeneissa. Merkitse avoimet suunnittelukohdat ja
puuttuvat esimerkit, joita tarvitset ratkaisun tekemiseen.

Jari käy suunnittelukeskustelun ja palautettu suunnitelma sovitetaan yhteiseen
`design-system/design.md`:hen ja vedoksiin.
