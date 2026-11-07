# Tulos: Palaa tähän, Jarin kolme kommenttia

1. **⋯ kortin oikeaan yläkulmaan.** Viestin omat toiminnot ovat otsakkeen
   viimeisinä ja työntyvät oikeaan reunaan; kopioi ja aika jäävät
   vasemmalle.
2. **Suhteettoman iso *Viimeisimpään*.** Syy: kun arkki aukeaa, valittu
   viesti vieritetään ylös, keskustelu ei ole enää lopussa ja
   *Viimeisimpään* ilmestyy kehyksen kelluvaan paikkaan arkin viereen.
   Paikka oli vaakarivi, joka venytti pillerin arkin korkuiseksi (1440:
   192 px, 390: 329 px). Nyt kelluvat ohjaimet ovat pystyssä omassa
   koossaan, arkki lähimpänä kenttää ja pilleri sen yläpuolella.
3. **Commitoidut muutokset.** Palautus ei koskaan kirjoita Gitin
   historiaa: tiedostot palaavat työpuuhun, joten jo commitoidut muutokset
   jäävät commiteihin ja palautetut tiedostot näkyvät commitoimattomina
   muutoksina HEADiin nähden. Daemonin esikatselu merkitsee tiedoston
   `committed`, kun HEADin historiassa on viestin jälkeen tehty commit,
   joka muutti sitä (`git log --since`, tiedoston omassa repossa, vain
   luku henkilönä itsenään). Arkki sanoo ennen vahvistusta *Jo commitoitu:
   …* (enintään kolme nimeä ja määrä) ja mitä palautus niille tekee;
   tiedostolistassa ne on merkitty *commitoitu*. Pelkkä keskustelu ei
   sano committeista mitään, koska se ei koske tiedostoihin.

## Todisteet

- `web/tests/rewind-conversation.spec.ts` (1440, 390): ⋯ on kortin
  oikeassa yläkulmassa; matalalla sivulla ylös vieritettynä
  *Viimeisimpään* on alle 56 px korkea ja arkin yläpuolella. Molemmat
  väitteet kaatuivat vanhalla CSS:llä (⋯ 79–87 px reunasta, pilleri 192 /
  329 px).
- `internal/daemon/rewind_native_linux_test.go`
  `TestRewindPreviewNamesCommittedFiles`: oikea Git-repo; viestin jälkeen
  commitoitu muutos, commitoitu uusi tiedosto ja commitissa poistettu
  hakemisto merkitään, commitoimaton muutos ja ennen viestiä tehty commit
  eivät; `false` ei näy langalla.
- `Rewind.test.tsx`: arkin teksti, listan merkintä, ja ettei mitään sanota
  ilman committeja tai pelkälle keskustelulle. Sopimus ja esimerkki
  validoituvat.

## Decisions for later review

1. **Commitoitua ei palauteta Gitissä, vain työpuussa** (ennalta
   valtuutettu oletus). Vaihtoehdot: (a) palauttava commit (`git revert`
   tai uusi commit tilannekuvasta), (b) `git reset` viestiä edeltäneeseen
   committiin. Valittu, koska historian kirjoittaminen on vaikeasti
   peruttava ja voi koskea jo työnnettyjä committeja; tiedostojen palautus
   on peruttavissa (*Peru palautus*, *Jatka tästä jatkosta*), ja henkilö
   tai agentti voi commitoida palautuksen itse.
2. **”Commitoitu” = HEADin commit viestin aikaleiman jälkeen muutti
   tiedostoa.** Vaihtoehto: laajennus kirjaa HEADin talteenotossa ja
   daemon vertaa `git diff <silloinen HEAD> HEAD`. Valittu, koska ei vaadi
   laajennuksen muutosta, toimii jo olemassa oleviin kopioihin ja
   tiedostoihin eri repoissa. Rajoitus: commit, sen peruminen ja uusi
   muokkaus samassa jatkossa merkitsee tiedoston, vaikka palautus jättäisi
   sen puhtaaksi (katselmoinnissa pudotettu harvinaisena).
3. **Vain listatut tiedostot (enintään 50) tarkistetaan**, yhteensä
   enintään 3 s Gitille; hidas tai puuttuva Git tarkoittaa ”ei merkintää”.
4. ***Viimeisimpään* pysyy arkin kanssa näkyvissä** (Jari pyysi korjaamaan
   koon), ei piiloteta arkin ajaksi.

## Katselmointi

Riippumaton `/llm-review` (etsijä gpt-6-astra, tarkistajaa ei tarvittu) ja
`/assess-findings`: 1 vahvistettu ja korjattu (commitissa poistetun
hakemiston tiedosto jäi merkitsemättä), 1 pudotettu (yllä kohta 2).
