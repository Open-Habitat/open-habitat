# Tavoite mukana keskustelussa – kierroksen tulos

Kokeiluopas kuvineen on [NOTES.md](NOTES.md):ssä. Valinta on Jarin, ja issue
jää avoimeksi (`preparation: pending`). Tuotantokoodi ei muuttunut.

## Akseli ja suunnat

Akseli on se, **missä pyyntö ja oppaan vaiheet ovat Aloitan jälkeen ja
lähetyksen jälkeen**. Aloitussivu, opas ja synteettiset Aurinkopolku-tavoitteet
ovat samat kaikissa suunnissa.

| Suunta | Aloitan jälkeen | Lähetyksen jälkeen | Mitä se päättää |
| --- | --- | --- | --- |
| **A Siru ja paneeli** | Tavoitesiru kentän yllä, ja kenttään jää vain paikkamerkki. Sirusta aukeaa pyyntö, ja **Muokkaa tekstinä** purkaa sen. Työpöydällä vaiheet aukeavat oikeaan paneeliin, puhelimessa yläpalkin **Opas**-painikkeesta. | Historiassa on tuotannon taitosiru, jossa näkyy tavoitteen nimi. Otsikko on tavoitteen nimi. **Opas** on käytettävissä myös uudelleenlatauksen jälkeen. | Tavoite on natiivi taito (1b), ja opas pysyy keskustelun vieressä. |
| **B Siru ja kortti** | Siru kuten A:ssa. Vaiheet ja pyyntö ovat sirun kortissa, ja paneelia ei ole. | Historian sirun lukunäkymä näyttää vaiheet (nykyiseltä aloitussivulta) ja tallennetun ohjeen. | Tavoite on natiivi taito (1b), mutta vaiheet näkyvät vain pyydettäessä. |
| **C Teksti ja paneeli** | Nykyinen raakateksti (tuotannon `goalDraft` sellaisenaan) ja vaiheet paneelissa. | Tuotannon nykyinen käytös. Taidolla aloitetussa viestissä on taitosiru ja koko pitkä pyyntö. Ilman taitoa jää pelkkä teksti, ja opas katoaa uudelleenlatauksessa. | Muoto ei muutu, ja paneeli on välilehden muistissa. |

Kaikissa suunnissa paneeli ja kortti kertovat, että vaiheet ovat ohjetta
eivätkä agentin edistymistä. Habitat ei tiedä, missä vaiheessa agentti on.

## Suositus: A

A vastaa suoraan kehittäjän kahteen havaintoon: vakiokehote ei täytä
kenttää, ja vaiheet ovat näkyvissä työn aikana. Lisäksi A säilyy
uudelleenlatauksen yli ilman uutta tallennetta, koska tavoitteen kertoo Pi:n
oma taitokutsu. B on kevyempi, mutta vaiheet ovat silloin kahden klikkauksen
takana juuri, kun niitä tarvitaan. C on halvin, mutta raakatekstiongelma
jää, ja ilman taitoa opas katoaa ensimmäisessä uudelleenlatauksessa.

Puhelimessa A:n paneeli ei aukea itsestään, koska se peittäisi juuri
täytetyn kentän. Puhelimen A muistuttaa siksi käytännössä B:tä, ja paneelin
saa auki yläpalkista.

Toteutuksen suunnittelussa kannattaa harkita yhtä yksinkertaistusta: siru
olisi viestikentän tapa näyttää luonnoksen alussa oleva `/skill:nimi`, eikä
erillistä tilaa tarvittaisi. Silloin Aloita kirjoittaa saman tekstin kuin
nyt. Itse kirjoitettu `/skill:x` saa saman sirun, ja **Muokkaa tekstinä**
vain lopettaa tekstin näyttämisen siruna. Prototyypissä siru on erillinen
tila, mutta käyttäjälle tulos näyttää samalta.

## Host-tiedot

| Tieto | Tarvitsee | On olemassa? |
| --- | --- | --- |
| Aloitussivun tavoitteet: `title`, `when`, `what`, `steps`, `prompt` ja valinnainen `skill` | kaikki | **On.** Daemon lukee `.agents/start-page.md`:n henkilön oikeuksin. |
| Taidon tarkistus komentolistasta ennen Aloitaa | kaikki | **On** (`StartPageRead`, `readCommands`). |
| Pi:n natiivi taitokutsu historiassa (nimi, kuvaus, tallennettu ohje) ja tuotannon taitosiru | A, B, C (taidolla) | **On** (`skill_linux.go`, `SkillInvocation`). |
| Oikean reunan paneeli keskustelun vieressä ja puhelimen koko ruudun paneeli | A, C | **On** (`ViewSplit`). Paneelin sisältö on uusi komponentti. |
| Viestikentän sirurivi kentän yllä | A, B | **Osittain.** Liitesirujen rivi on olemassa. Tavoitesirua tai luonnoksen alussa olevan `/skill:`-komennon näyttämistä siruna ei ole. |
| Jokainen tavoite on taito (1b): aloitussivutaito kirjoittaa `.agents/skills/<tavoite>/SKILL.md`:n (`disable-model-invocation: true`, kuvauksena tavoitteen nimi), ja aloitussivun `skill` viittaa siihen. | A, B | **Ei.** Tarvitaan muodon ja taidon ohjeen muutos. Daemon ja valtuudet eivät muutu. |
| Historian taitokutsusta takaisin aloitussivun tavoitteeseen (`goal.skill === entry.skill.name`) | A (Opas latauksen jälkeen), B (vaiheet historian sirussa) | **Ei**, mutta se on pelkkä selaimen vertailu kahdesta jo luetusta natiivista lähteestä. Uutta tallennetta ei tarvita. |
| Taidolla aloitetun keskustelun otsikko tavoitteen nimestä | A, B (kuvissa) | **Ei.** Nyt otsikko tulee ensimmäisestä viestistä raakatekstinä (`/skill:pytest-debug S…` labissa). Natiivi tapa olisi asettaa Pi:n istuntonimi (`session_info`) tai päätellä otsikko taitokutsun kuvauksesta. Tämä on oma päätöksensä. |
| Paneelin auki/kiinni-tila | A, C | Välilehden muistissa. Prototyyppi ei tallenna sitä, eikä toteutuksenkaan tarvitse. |
| Agentin edistyminen vaiheissa | ei mikään | **Ei**, ja sitä ei esitetä. |

Valtuudet: mikään suunta ei siirrä tietoa gatewaylle tai provisionille, eikä
mikään tuo uutta tallennetta.

## Kysymykset Jarille

1. A, B vai C? Suositus on A.
2. Hyväksytkö 1b:n, eli jokaisesta tavoitteesta tulee repoon taito, joka
   näkyy myös `/`-listassa ja terminaalin Pi:ssä?
3. Saako taidolla aloitettu keskustelu nimen tavoitteesta? Tämä on erillinen
   host-päätös.

## Toteutus ja tarkistus

Kierros on `design-system/prototypes/rounds/2026-10-27-tavoite-mukana/`.
Kuten `palvelin-aloitus`-kierrokset, se rakennetaan esbuildilla suoraan
tuotantokomponenteista. Viestikentän siru tulee mukaan niin, että
`build.mjs` ohjaa `Composer.tsx`:n `AttachmentChips`-tuonnin kierroksen
`chips.tsx`:ään, joka käärii tuotannon komponentin. `web/`-hakemistoon ei
tehty muutoksia. Tyylit ladataan `main.tsx`:n järjestyksessä.

```sh
cd web && npm ci            # tarvittaessa
node design-system/prototypes/rounds/2026-10-27-tavoite-mukana/build.mjs
#   → design-system/prototypes/dist/tavoite-mukana/index.html (itsenäinen, fontit upotettu)
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-10-27-tavoite-mukana/check.mjs \
  design-system/prototypes/dist/tavoite-mukana/index.html /var/tmp/<oma>/check
# Nykytila labista: OH_PORT_BASE=<oma> scripts/lab.sh start && node …/baseline.mjs <hakemisto>
```

`check.mjs` ajoi Birchlla 13 ajoa (`checks.json`). Ajot kattoivat suunnat
A/B/C, leveydet 1440 ja 390 px sekä vaalean ja tumman teeman, ja lisäksi
erillistarkistuksen, joka kokeili Muokkaa tekstinä -toimintoa, C:tä ilman
taitoa ja puhelinkehystä. Valitsimen tarkistus (`picker-check.mjs`) meni
läpi, konsoli pysyi puhtaana, eikä vaakavieritystä syntynyt. Ajot tarkistivat:

- kentän sisällön ja paikkamerkin valinnan
- sirun kortin sisällön suunnittain
- paneelin oletustilan (työpöytä auki, puhelin kiinni)
- lähetyksen ja historian sirun
- uudelleenlatauksen jälkeisen Opas-painikkeen.

Kuvat ovat `kuvat/`-hakemistossa: 24 WebP-kuvaa device scale factorilla 2.
Neljä `nyt-*`-kuvaa on otettu tuotannon labista.

Rajoitukset: prototyyppi on synteettinen eikä host-integraation näyttö.
Vastaukset on kirjoitettu käsin. Taitosirun lukunäkymä näyttää tallennetuksi
ohjeeksi kierroksen tekstin, ei oikeaa taitotiedostoa. Synteettisessä datassa
paikkamerkit on siirretty loppuun, kuten aloitussivutaito nyt ohjeistaa.
Kierroksen 2 data oli vanhaa muotoa, ja `goalDraft` jättäisi siitä
lauseeseen tyhjän kohdan (`syy: .`).
