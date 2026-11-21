# Prototyyppikierros 4: muistilappu omin sanoin, kieli ja sama editori kuin Asetuksissa

## Saatesanat

Jari, tässä on kierroksen 3 kahden parhaan yhdistelmä. Sanat ovat A2
Muistilapusta: "Agentti ei muista aiempia keskusteluja. Tehdään sille
muistilappu…". Lappu on A3:n tapaan vapaata tekstiä, jota voi muokata
itse. Uutta on kaksi asiaa. Ihminen saa kirjoittaa omin sanoin, mitä
agentin pitäisi tietää. Agentti tarjoaa vain isojen alkukirjainten ja
välimerkkien korjausta, ja lappuun menee hänen oma tekstinsä, ellei hän
valitse korjattua. Lisäksi ihminen valitsee, millä kielellä agentti
vastaa. Oletuksena on Habitatin kieli. Valmis lappu näytetään samassa
editorissa, joka on Asetusten Tili › Ohjeet agentille -näkymässä:
Esikatselu, Muokkaa, Tallenna ja Peru. Muunnelmat eroavat siinä, missä
omat sanat ja kieli ovat. **A4.1 Keskustelu** kysyy kielen ensin ja omat
sanat viimeisenä. **A4.2 Ensin itse** antaa kirjoittaa ensin ja kysyy sitten
loput. **A4.3 Vieressä** näyttää lapun keskustelun vieressä koko ajan.
Suosittelen muunnelmaa **A4.1 Keskustelu**.

## Sivu

- Rakennettu sivu: `/var/tmp/agent-keep/new-user-agent-instructions-template/round-4/offline.html`
  (fontit upotettuina) ja `index.html` (ilman fontteja Glasspadia varten).
- Ruutukaappaukset (1440 ja 390 px; Päivä, Yö ja Kontrasti; suomi ja
  englanti; uusi ja olemassa oleva tili):
  `/var/tmp/agent-keep/new-user-agent-instructions-template/round-4/shots/`.
- Lähteet: `design-system/prototypes/rounds/2026-11-21-onboarding-instructions-4/`.
  Jaettu editori on `design-system/prototypes/rounds/2026-11-21-instructions-settings-2/editor.tsx`.
  Rakennus: `node build.mjs <out>`. Tarkistus: `node check.mjs <out>/offline.html <shots>`
  (1026 tarkistusta, konsoli puhdas; 86 ruutukaappausta).
- Rakenne ja yhteiset säännöt: kierroksen `NOTES.md`.

## Akseli ja muunnelmat

Akseli: **missä omat sanat ja kielivalinta ovat.** Sanat, kysymykset,
vastausvaihtoehdot ja editori ovat samat kaikissa muunnelmissa.

- **A4.1 Keskustelu.** Agentti kysyy ensin: "Millä kielellä vastaan
  sinulle? Habitat on suomeksi, joten ehdotan sitä." Ensimmäinen ja
  korostettu pikavastaus on Habitatin kieli. Sen jälkeen tulevat GitHubin
  tiedon tarkistus, vastaustyyli ja se, mitä agentti ei saa tehdä
  kysymättä. Viimeisenä agentti pyytää: "Kerro vielä omin sanoin, mitä
  minun pitäisi tietää sinusta." Vuorossa on tekstikenttä ja Ohita. Lappu
  näytetään lopuksi kerran kokonaisena.
- **A4.2 Ensin itse.** Keskustelua ennen on kortti, jossa on kielivalinta
  (valmiiksi valittuna) ja kysymys "Mitä agentin pitäisi tietää sinusta?".
  Painikkeet ovat Jatka ja En keksi nyt, kysy sinä. Sen jälkeen agentti
  kysyy vain loput. Kokeneelle käyttäjälle tämä on nopein, mutta tyhjä
  kenttä on ensimmäinen asia, jonka aloittelija näkee.
- **A4.3 Vieressä.** Lappu näkyy keskustelun vieressä alusta asti ja täyttyy
  vastausten mukana. Kieli on lapun yläreunassa ja omat sanat sen alla.
  Lappua voi muokata vasta, kun kysymykset on käyty (syy näkyy), koska
  muuten ihmisen ja agentin samaan aikaan kirjoittama teksti pitäisi
  yhdistää. Kaksi saraketta ei mahdu nykyiseen 860 px:n reittikehykseen.
  Muunnelma levittää sen tällä vaiheella 1280 px:iin, ja tämä olisi
  tuotantomuutos.

Kaikissa sama: tiedosto näytetään ennen tallennusta, keskustelussa ei
puhuta poluista, AGENTS.md:stä, Pi:stä eikä Claudesta, keskustelu ei näy
sivupalkissa, ja Tee myöhemmin sekä Jätä ennalleen eivät kirjoita mitään.
Olemassa olevalle tilille kieltä ei kysytä, vanha teksti näkyy editorissa
merkinnällä Ennallaan ja lisäys merkinnällä Uutta.

## Suositus

**A4.1 Keskustelu.** Polku on yksi ja suora. Kieli on valmiiksi oikein,
joten vastaamiseen riittää yksi napautus. Omat sanat kysytään vasta, kun
ihminen on nähnyt, millaisia asioita lappuun tulee, joten tyhjä kenttä ei
ole ensimmäinen asia ja hänellä on mallia. Lappu näytetään kerran ja
kokonaisena. A4.2 sopii kokeneelle, mutta aloittelija jää tyhjän kentän
eteen. A4.3 näyttää parhaalta leveällä näytöllä, mutta se vaatii leveämmän
reittikehyksen. Lisäksi lukitus kysymysten ajaksi on keinotekoinen raja,
jota ihminen ei ymmärrä ilman selitystä.

## Mitä host-tietoja ja -operaatioita vaihe olettaa

- Ihmisen nimi ja GitHub-kuvaus sekä Habitatin kieli (henkilön oma valinta
  tai selaimen kieli, kun valintana on Järjestelmä). Kaikki nämä ovat jo
  selaimen tiedossa.
- Lapun **kirjoittaa sivu, ei agentti**: Tallenna käyttää samaa
  ohjetiedoston kirjoitusoperaatiota kuin Asetukset (kuvattu kohdassa
  "Päätökset myöhempää katselmointia varten"). Tämä on muutos kierrokseen 3,
  jossa agentti kirjoitti tiedostot työkaluillaan.

## Päätökset myöhempää katselmointia varten

- **Lapun kirjoittaa sivu daemonin kautta, ei agentti.** Vaihtoehto oli,
  että agentti kirjoittaa tiedoston työkaluillaan kuten kierroksessa 3.
  Kun ihminen voi muokata agentin luonnosta ennen tallennusta, tallennettava
  teksti on editorissa eikä agentin kontekstissa. Agentin pitäisi saada se
  takaisin ja kirjoittaa se sanasta sanaan, mikä on turha kierros ja
  virhelähde. Sama daemonin operaatio tarvitaan Asetuksissa joka
  tapauksessa. Uudelle tilille se luo tiedoston vain, jos tiedostoa ei ole
  (`O_EXCL`). Olemassa olevalle tilille se korvaa tiedoston vain, jos tiedosto
  on yhä se, joka luettiin vaiheen alussa (vertaa ja vaihda). "Missä ohjeet
  ovat?" näyttää yhä kirjoitetut tiedostot. Prototyyppi piirtää ne
  tuotannon `ToolRow`-riveinä, mutta toteutuksessa ne ovat tiedostorivejä,
  eivät agentin työkalurivejä.
- **Omat sanat omassa `## Omin sanoin` -osiossaan.** Vaihtoehto oli
  sekoittaa ne muuhun tekstiin A3:n tapaan. Otsikoitu osio kertoo agentille
  myöhemmin, mikä teksti on ihmisen omaa ja säilytetään sanasta sanaan.
  Muu lappu pysyy vapaana tekstinä.
- **Korjausta tarjotaan, sitä ei tehdä huomaamatta.** Agentti korjaa vain
  isot alkukirjaimet ja välimerkit. Ensin lappuun menee ihmisen teksti
  sellaisenaan, ja korjattu versio on erillinen valinta (Pidä omani / Käytä
  korjattua). Vaihtoehdot olivat kirjoittaa teksti aina sellaisenaan tai
  korjata se automaattisesti. Brief sanoi, että teksti pysyy hänen.
- **Kielen oletus on Habitatin kieli, ja vaihtoehdot ovat suomi, englanti ja
  ruotsi.** Habitat ei tunne muita kieliä, ja muun kielen voi kirjoittaa
  lappuun itse. Vaihtoehtona oli vapaa kielikenttä, mutta se olisi turha
  kenttä lähes jokaiselle. Keskustelu jatkuu käyttöliittymän kielellä, vaikka
  vastauskieleksi valittaisiin muu: kieli on lapun sisältöä, ja vaihe on osa
  käyttöliittymää.
- **Olemassa olevalle tilille kieltä ei kysytä.** Vanhassa tekstissä
  kieli on jo kerrottu. Uusi lause voisi olla ristiriidassa sen kanssa.
- **Editorin Peru palauttaa agentin version.** Käyttöönotossa tiedostoa ei
  vielä ole levyllä, joten Tallenna näkyy ilman muokkauksiakin ja Peru
  kumoaa vain ihmisen omat muokkaukset.
- **A4.3:n lukitus kysymysten ajaksi** on muunnelman oma ratkaisu, ei
  editorin sääntö. Editori osaisi yhdistää agentin uudet rivit muokattuun
  tekstiin, mutta vaiheen keskellä se olisi aloittelijalle hämmentävää.

## Kysymykset Jarille

1. Kelpaako A4.1 Keskustelu? Vai tuntuuko A4.2:n "ensin itse" tai A4.3:n
   jatkuvasti näkyvä lappu paremmalta?
2. Riittävätkö suomi, englanti ja ruotsi kielivaihtoehdoiksi, kun muun
   kielen voi kirjoittaa lappuun itse? Ja jatkuuko vaihe käyttöliittymän
   kielellä, vaikka vastauskieleksi valitaan muu?
3. Sopiiko, että agentti tarjoaa vain isojen alkukirjainten ja välimerkkien
   korjausta, ja oletuksena lappuun menee ihmisen oma teksti?
4. Hyväksytkö, että käyttöönoton Tallenna kirjoittaa lapun saman daemonin
   operaation kautta kuin Asetukset eikä agentin työkaluilla? Operaatio
   kuvataan tarkemmin `result-settings-2.md`:ssä.
