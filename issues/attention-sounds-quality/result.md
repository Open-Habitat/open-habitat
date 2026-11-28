# Huomioäänten laatu, kierros 1

Kierros on hakemistossa
`design-system/prototypes/rounds/2026-11-28-aanet-laatu-1/`. Rakennus:
`node design-system/prototypes/rounds/2026-11-28-aanet-laatu-1/build.mjs`,
joka kirjoittaa `design-system/prototypes/dist/2026-11-28-aanet-laatu-1/`
-hakemistoon `offline.html`:n (fontit mukana) ja `index.html`:n. Mittaukset
ja perustelut ovat [research.md](research.md):ssä.

## Saatesanat

Sivulla on kaikki kymmenen nykyistä ääntä rinnakkain ehdotussarjan kanssa.
Valitsin vaihtaa ehdotussarjaa (A Avattu, B Kirkas, C Yksi isku), ja rivin
pienet painikkeet soittavat saman äänen kahdesta muusta sarjasta. *Vertaa*
soittaa nykyisen ja heti perään ehdotuksen. Jokaisen äänen aaltomuoto on
piirretty samalle 1,6 sekunnin asteikolle. Yläreunan *Pituus* vaihtaa
lyhyen ja pitkän version välillä. Kaikki sarjat on tasattu samaan
äänekkyyteen (−17 LUFS), joten erot ovat sävyssä eivätkä voimakkuudessa.

Akseli on, kuinka paljon äänet muuttuvat. **A** korjaa vain tekniset viat:
yläpää aukeaa, häntä soi itse loppuun eikä vaimennuskäyrä katkaise sitä,
eikä oktaavia alempaa huminaa tai laatikkomaista kaikua ole. **B** tuo
lisäksi lasin, metallin ja jään yläsävelet kimaltamaan ja huojumaan,
nostaa niiden rekisteriä ja karsii iskut enintään kolmeen. Puiset äänet ja
vesi pysyvät lämpiminä. **C** lyö B:n äänet yhtenä eleenä, melkein yhtä
aikaa, jolloin koko pituus soi.

Suosittelen **B Kirkasta**. Se korjaa mitatut viat ja on lähimpänä
vertailuäänen luonnetta, mutta jokaisella äänellä on yhä oma eleensä, joten
työtilojen äänet erottuvat ja Tunnus puu on yhä Habitatin aihe. C:ssä
Marimba ja Tunnus puu muuttuvat lähes samaksi duurisoinnuksi.

## Todisteet

- `check.mjs` meni läpi 1063 tarkistuksella. Kaikkien neljän sarjan kaikki
  80 renderöintiä ovat −17 ±0,3 LUFS:n sisällä, true peak on alle −2,9
  dBFS, mikään näyte ei leikkaannu, ja viimeiset 50 ms ovat alle −50 dBFS.
  Ehdotusten hännät soivat loppuun ilman vaimennuskäyrää. Lisäksi
  tarkistettiin valitsin, kymmenen riviä ja 20 piirrettyä aaltomuotoa joka
  suunnassa 1440 ja 390 px:n leveydellä Päivä- ja Yö-teemoissa, ▶-painikkeiden
  vierekkäisyys oman aaltomuotonsa kanssa ja rivin yksirivisyys
  työpöydällä. Klikattuina tarkistettiin, että soitettu ääni on sama kuin
  Noden renderöimä, Vertaa, muiden sarjojen painikkeet, pituuden vaihto,
  äänenvoimakkuus (tuotannon neliöllinen käyrä) ja Soita kaikki.
  Konsoli pysyi puhtaana, eikä sivu tehnyt ulkoisia pyyntöjä.
- Äänet arvioitiin mittaamalla ja fysiikan perusteella, ei korvalla.
  Ratkaisu tehdään kuuntelemalla.

## Päätökset myöhempää katselmointia varten

- Vertailukohdan (Apple Glass) ääntä ei käytetty eikä mitattu: sitä ei ole
  tällä koneella, eikä siitä löytynyt julkaistua mittausta. Vertailu
  nojaa lyödyn lasin fysiikkaan ja julkisiin kuvauksiin.
- Äänekkyysnormitus on ennallaan (−17 LUFS hetkellinen maksimi, huippu
  enintään −3 dBFS). Äänekkyys ei ollut vika.
- Ehdotukset käsittelevät samat kymmenen ääntä samoilla tunnisteilla, joten
  valittu sarja voi korvata nykyiset reseptit ilman muutoksia asetuksiin
  tai tallennettuihin valintoihin.
- Pituudet ovat 0,8 s ja 1,6 s, eli aiempien rajojen ylälaidassa. Näin
  äänellä on aikaa soida loppuun.
- Sivu ei tarvitse hostilta mitään: äänet syntyvät selaimessa.

## Kysymykset Jarille

1. Kumpi sarja: suosittelemani B, vai A tai C?
2. Saako yläpää avautua yli 6 kHz:n? Kierroksella 2 linjattiin "ei
   terävyyttä yli ~6 kHz". B ja C perustuvat siihen, että tuo raja
   poistetaan, ja terävyyttä hallitaan iskun kohinalla ja yläsävelten
   tasolla. Kuuntele erityisesti läppärin omista kaiuttimista.
3. Saavatko puiset äänet (Marimba, Tunnus puu) jäädä lämpimiksi, vai
   pitäisikö niidenkin kirkastua?
