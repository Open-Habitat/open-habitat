# Tallennustilan erittely – kierros 1

Issue `storage-warning-no-breakdown`. Suunnat, suositus ja myöhemmin
katselmoitavat päätökset ovat issuen `result.md`:ssä.

Sivu on tuotannon kehys (`AppShell`, `WorkspaceRail`) ja tuotannon
`AccountSettings` Tallennustila-osiossaan (`PersonalStorage`) synteettisillä
vastauksilla: Worktreet- ja Roskakori-osiot ovat tuotannon omia. Kierros
korvaa vain käyttökortin (`data-settings-row="usage"`) omalla kortillaan.
Kortti on koottu tuotannon palasista (`WarningBannerView`, `ControlButton`,
`Checkbox`, `Select`, `TextArea`, `StatusMark`, `Icon`, react-arian ikkuna)
ja tuotannon luokista (`s-card`, `ah-trash-usage`, `ah-trash-bar`,
`ah-trash-swatch`, `ah-trash-legend`). Uusi keskustelu on merkitty
sijainen-ikkuna, jossa valmis pyyntö on kentässä lähettämättä.

Suunnat: A Pylväs (tuotannon palkki ryhmiin, ryhmät avautuvat), B
Vapautettavissa (valintalista ensin, pyyntö valinnoista) ja C Kansioittain
(yksi kokojärjestetty kansiotaulukko). `text.ts` on kierroksen sanasto
suomeksi ja englanniksi. `?s=varoitus|normaali|mitataan|jaettu` ja
`?theme=dark` valitsevat alkutilan.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-14-storage-breakdown/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 590 \
  node design-system/prototypes/rounds/2026-11-14-storage-breakdown/check.mjs \
  design-system/prototypes/dist/storage-breakdown/offline.html <kuvahakemisto>
```

`web/node_modules` tarvitaan lukitiedoston mukaisena (`npm ci --prefix web`).
`offline.html` on yksi itsenäinen tiedosto fontteineen. Tarkistus käy kolme
suuntaa ja neljä tilannetta 1440 ja 390 px:n leveydellä, vaaleana ja
tummana. Se klikkaa siivouspyynnön (pyyntö nimeää välimuistit ja säästää
käynnissä olevat workerit), B:n valinnat, uudelleenmittauksen, C:n Näytä
kaikki ja englannin. Konsoli on puhdas.

## What the host would need

Nykytila: daemon lukee käyttäjän kiintiön (`/api/v1/account/storage`,
`usage_bytes`/`limit_bytes`, tai jaetun levyn `filesystem`), ja selain
kysyy sitä 10 sekunnin välein (`StoragePressure.tsx`). Kiintiön luku on
halpa, koska tiedostojärjestelmä pitää summan valmiina. Erittely ei ole
halpa: se on hakemistopuiden läpikäynti. Worktree-listaus
(`worktree_list`) laskee jo worktreen koon (`size_bytes`,
`size_complete`) ja tietää sen omistavan Taskfleet-ajon (`owner.role`,
`owner.state`, `taskfleet_run`-este) sekä sisällä olevat prosessit. Roskakori
laskee entryjensä koot (`trash_list`).

**Mitä daemon mittaa ja miten halvalla.** Daemon käy läpi vain kiinteän
luettelon juuria, ei koko kotihakemistoa. Se laskee `st_blocks`-summan
`fstatat`-kutsuilla, ei seuraa symbolisia linkkejä eikä ylitä
liitospisteitä (sama `st_dev` kuin kotihakemistolla). Pilviliitokset ja
muut mountit jäävät siis pois, kuten roskakorin ja worktreiden poistossa jo
nyt. Kovat linkit lasketaan kerran (inode-joukko mittauksen ajan).
Työtilat- ja Muu-rivit saadaan vähentämällä: Työtilat on `~/src`:n summa
ilman sen alta löytyneitä käännöshakemistoja, ja Muu on kiintiön käyttö
miinus kaikki tunnistettu. Muu ei siis vaadi koko kodin läpikäyntiä, kun kiintiö on käytössä. Ilman käyttäjäkohtaisia rajoja omaa käyttöä ei tiedetä ilman koko kodin läpikäyntiä, joten silloin mittaus käy kodin läpi samoilla säännöillä ja harvemmin (enintään kerran tunnissa, ellei ihminen pyydä). Go:n
käännösvälimuistissa voi olla satoja tuhansia tiedostoja, joten yksi mittaus
kestää kymmeniä sekunteja. Se ajetaan yhtenä kerrallaan
(single-flight) matalalla prioriteetilla (`nice`, `ionice -c3`), ja sillä
on aikaraja. Aikarajan ylittävä mittaus palauttaa osittaisen tuloksen
`complete: false` -merkinnällä, kuten `size_complete` nyt.

**Kuinka usein.** Daemon pitää viimeisimmän tuloksen ja sen
mittausajan muistissa, ei levyllä. Uudelleenkäynnistys mittaa uudelleen,
eikä toista totuutta synny. Mittaus käynnistyy kolmesta syystä: kun
Tallennustila avataan ja tulos on yli 15 minuuttia vanha, kun kiintiö
ylittää 85 % (sama raja kuin varoituksella) ja kun ihminen painaa Mittaa
uudelleen. Taustalla ei mitata ajastetusti. Näkymä näyttää mittausajan ja
ensimmäisen mittauksen keskeneräisyyden, joten vanha luku ei näytä
nykyiseltä.

**Mitkä polut lasketaan tunnetuiksi välimuisteiksi.** Kiinteä taulukko
daemonissa: polku, laji ja työkalun oma siivouskomento.

| Laji | Polku | Komento |
|---|---|---|
| Go-käännösvälimuisti | `GOCACHE`, oletus `~/.cache/go-build` | `go clean -cache` |
| Go-moduulit | `GOMODCACHE`, oletus `~/go/pkg/mod` | `go clean -modcache` (tiedostot ovat kirjoitussuojattuja, `rm` ei toimi) |
| npm | `~/.npm/_cacache`, `~/.npm/_npx` | `npm cache clean --force` |
| Cargo-rekisteri | `~/.cargo/registry/{cache,src}`, `~/.cargo/git/{db,checkouts}` | hakemiston poisto (Cargo hakee uudelleen) |
| Playwright | `PLAYWRIGHT_BROWSERS_PATH`, oletus `~/.cache/ms-playwright` | `npx playwright uninstall --all` |
| uv | `~/.cache/uv` | `uv cache clean` |
| pip | `~/.cache/pip` | `pip cache purge` |

Go:n polut luetaan käyttäjän `go env -w` -tiedostosta
(`~/.config/go/env`), jos sellainen on. Daemon ei näe agenttien
ympäristömuuttujia, joten ajon aikana annettu `GOCACHE` jää näkymättä.
Siksi alla oleva suositus pitää välimuistin oletuspaikassa. Lisäksi lasketaan
mikä tahansa `~/.cache`-alihakemisto, jossa on vakiomuotoinen `CACHEDIR.TAG`
(Cache Directory Tagging Specification), rivinä "Muu välimuisti" polkuineen.

**Käännöshakemistot ja miten käynnissä oleva worktree erotetaan.**
Käännöshakemistoja etsitään vain worktreiden ja työtilojen pääkopioiden
juurista ja yhden tason syvyydeltä: `target/`, jossa on Cargon
`CACHEDIR.TAG`, ja `node_modules/`, jonka vieressä on `package.json`. Kunkin
hakemiston tila tulee worktree-listauksen nykyisistä tiedoista, ei uudesta
päättelystä:

- *Worker käynnissä*: worktreellä on omistaja, jonka `owner.state` ei ole
  `ended`, tai siinä on `taskfleet_run`- tai `process`-este. Nämä ovat samat
  tarkistukset, jotka nyt estävät worktreen poiston.
- *Valmis*: omistaja on `ended`, tai worktree on yhdistetty (`merged`)
  eikä siinä ole estettä.
- *Pääkopio*: työtilan oma checkout. Ihminen voi kääntää siinä itse, joten
  sitä ei oleta poistettavaksi.

**Rajapinta.** Uusi luku `contracts/v1/`-skeemaan, esimerkiksi
`account-storage-breakdown`: `measured_at`, `measuring`, `complete` ja
`items` (`group`, `kind`, kotihakemistoon suhteellinen `path`, `bytes`,
`complete`, käännöshakemistolle `state` sekä `run_id` ja `title`).
Ryhmäsummat ovat summia riveistä. Daemon ei saa poisto-operaatiota:
siivouksen tekee agentti ihmisen pyynnöstä ja ihmisen nähden. Pyyntöteksti
kootaan selaimessa erittelystä. Uusi keskustelu avataan nykyisellä
keskustelun luonnilla valittuun työtilaan, ja teksti on kentässä
lähettämättä. Valtaa ei siirry komponentilta toiselle: daemon mittaa
käyttäjänä tämän omaa kotihakemistoa.

## Missä Go:n käännösvälimuistin pitäisi olla

Suositus: yksi käyttäjäkohtainen `GOCACHE` oletuspaikassa
`~/.cache/go-build`, yhteinen kaikille agenttien ja workerien ajoille. Ei
ajokohtaista välimuistia, eikä siirtoa kotihakemiston ulkopuolelle.

- **Jakaminen ajojen välillä on välimuistin koko arvo.** Go:n
  välimuisti on sisältöosoitteinen ja turvallinen samanaikaisille
  prosesseille. Rinnakkaiset workerit samasta repositoriosta osuvat samoihin
  merkintöihin. Ajokohtainen `GOCACHE` kääntäisi jokaisessa worktreessä
  kaiken alusta ja moninkertaistaisi tilan juuri silloin, kun workereita on
  monta.
- **Kiintiö.** Kotihakemistossa välimuisti lasketaan ihmisen kiintiöön.
  Juuri niin pitääkin olla, koska Unix-käyttäjä ja sen kiintiö ovat
  tuotteen raja. Jaetussa scratch-hakemistossa (`/var/tmp`) välimuisti
  ohittaisi kiintiön ja täyttäisi kaikkien yhteistä levyä, jota kukaan ei
  näe omana käyttönään. Pyyhittävä scratch on oikea paikka
  kertakäyttöisille käännöksille ja testihakemistoille, ei välimuistille,
  jonka hyöty syntyy uudelleenkäytöstä.
- **Koon hallinta.** Go karsii itse merkinnät, joita ei ole käytetty
  viiteen päivään. 24 GiB:n välimuisti on siis viiden päivän käännösten
  kirjo (eri liput, `-race`, kattavuus, monta haaraa), ei vuosien kertymä.
  Yläraja tulee kiintiöstä ja varoituksesta, ja tämän kierroksen
  erittely näyttää välimuistin omana rivinään. Siivous on `go clean -cache`
  agentin kautta. Erillistä kokorajaa Go ei tarjoa, eikä sellaista rakenneta.
- **Näkyvyys.** Oletuspaikassa daemon löytää välimuistin. Ajonaikainen
  `GOCACHE` jossain muualla olisi juuri se tila, jota erittely ei näe.
  Jos asennus haluaa välimuistin muualle, se asetetaan `go env -w
  GOCACHE=…` -komennolla, jonka daemon lukee.
