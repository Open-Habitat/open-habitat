# Keskustelunäkymän staattinen koostamisesimerkki

Tämä hakemisto on ensimmäisen keskusteludesignin (20.9.2026) mukana tullut
staattinen HTML-sivu, joka kokoaa design systemin tokenit yhdeksi työskentelyn
aikaiseksi keskustelunäkymäksi: yläpalkki, viesti- ja työkalusyöte sekä
composer jonoineen. Se on säilytetty, koska se on ainoa ilman buildia
selaimessa avautuva sivu, jolla tokenit näkyvät realistisessa sommittelussa
yhtä aikaa; `guidelines/`-kortit näyttävät ne yksi kerrallaan. Kun muutat
tokeneita tai `styles.css`-tiedostoa, tämä sivu on nopea tapa nähdä muutoksen
vaikutus kokonaisuuteen molemmissa teemoissa. Sivu avautuu vaaleana; tumman
teeman näet asettamalla `<html>`-elementille `data-theme="dark"`.

Muuta se ei ole. Sivu on tehty ennen tuotantodesignia ja näyttää ratkaisuja,
jotka katselmoinnissa hylättiin tai muutettiin: yksittäisen jonorivin
perumisen sekä lähetyksen jaon "heti" ja "jonoon", joka ei vastaa
tuotantodesignin steer/follow-up-valikkoa. Miten keskustelunäkymä oikeasti
toimii, kertoo [`production-v1.md`](../../production-v1.md), erityisesti osio
"Composer, jono ja epävarma komento"; oikeat komponentit ovat
`web/src/components/`-hakemistossa ja Storybookin `Production/Catalog`-tarinassa
`Conversation`. Kun tämä sivu ja ne ovat eri mieltä, ne ovat oikeassa.
Alkuperäinen klikattava pääpolku ja tilavedokset ovat
[`design-system/drafts/v1/vedokset/`](../../drafts/v1/vedokset/)-hakemistossa
muuttumattomana evidenssinä.

Sivu linkittää tyylit vain `../../styles.css`:n kautta, ja siinä on sen koko
käyttöarvo: näin se seuraa tokenimuutoksia ja teeman vaihtoa ilman omaa
ylläpitoa, kun taas kova arvo täällä näyttäisi tokenimuutoksen jälkeen jotain,
mitä design system ei enää sano. Tiedoston alun `@dsCard`- ja
`@startingPoint`-kommentit ovat suunnittelijan työkalun merkintöjä, joita
mikään tässä repossa ei lue.

Sivua saa muokata, kunhan se pysyy tokenien koosteena eikä ala esittää uutta
tuotevaatimusta. Sen jono, painikkeet, nimet ja muut näkymäkohtaiset valinnat
ovat yhden vedoksen ratkaisuja; syy, miksi sellaisia ei nosteta design systemin
yleisiksi säännöiksi, on hakemiston yläpuolisessa [`AGENTS.md`](../../AGENTS.md):ssä.
Jos sivu ei enää vastaa tokeneita eikä sitä kannata korjata, poistaminen on
parempi kuin vanhentunut kopio: `ui_kits/production-v1/` poistettiin samasta
syystä, kun ajettava katalogi korvasi sen.
