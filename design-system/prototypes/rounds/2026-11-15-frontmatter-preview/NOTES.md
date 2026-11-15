# Front matterin esikatselu – kierros 1

Akseli: miten editorin esikatselu näyttää sisäkkäisen YAML-rakenteen.

- **Nyt** (vertailu): tuotannon nykyinen esikatselu sellaisenaan.
- **1 Sisäkkäin**: kaikki auki sisäkkäisenä määrittelyluettelona. Jokainen taso
  on sisennetty hiljaisen pystyviivan alle, ja sisennys lakkaa kasvamasta
  neljännen tason jälkeen. Olioiden listat näkyvät numeroituina kortteina,
  joiden otsikkona on `title`/`name`/`heading`. Lyhyet merkkijonolistat
  ovat siruja ja pitkät luetteloita. Monirivinen teksti on lainauslohko.
  Tyhjät arvot on nimetty (”tyhjä”, ”ei kohtia”). Totuusarvot ja luvut
  näkyvät monospacella.
- **2 Puu**: kaksi tasoa auki, syvemmät kiinni määrineen (”3 avainta ·
  type, image, …”). Avaa kaikki / Sulje kaikki. Samanmuotoisten olioiden
  lista (start pagen goals, workflow’n steps) on taulukko, jossa on enintään
  kolme lyhyttä saraketta, ja rivi avautuu loppujen kenttien puuksi.
- **3 Sivuna**: kun Habitat tuntee tiedoston (`.agents/start-page.md`),
  esikatselu näyttää sen niin kuin työtilan sivu näyttää: tuotannon
  `WorkspaceIntro` otsikkoineen, ensimmäinen kappale, Näytä koko esittely
  ja tavoitekortit. Alla on jokaisen tavoitteen opas (Milloin, Mitä saat,
  Näin etenet, pyyntö täytettävä kohta korostettuna, `/skill:`-siru,
  ”Lähtee heti valittaessa”, keskustelun nimi) sekä kelpoisuus: kelpaa ja
  tavoitteiden määrä, tai mikä tavoite ja kenttä estää sivun.
  Tavoitekortin painallus vie sen oppaaseen. Muut tiedostot näkyvät
  kuten 1:ssä.

Kaikissa suunnissa (paitsi Nyt) myös pelkkä `.yml`/`.yaml` saa esikatselun
samalla piirtäjällä ilman laatikkoa, ja Markdown-runko näkyy front matterin
alla tuotannon `Markdown`-komponentilla.

Sivu on tuotannon kehys: `AppShell`, `WorkspaceRail`, `EditorSplit`,
`EditorHeaderActions`, `EditorFileTree`, CodeMirror-tekstinäkymä,
`ConversationFrame`, viestit, `Composer`, `Markdown` ja `WorkspaceIntro`.
Editorin työkalurivi on tuotannon merkintä ja luokat uudelleen piirrettynä,
koska `BrowserEditor` sitoo esikatselun ja YAML-poissulun sisäänsä.
Piirtäjät ovat kierroksen omia (`fm.tsx`). Arvot ovat totuus ja tiedoston
teksti kirjoitetaan niistä, joten tekstinäkymän muokkaus ei päivitä
esikatselua tässä vedoksessa.

`?theme=light|dark|contrast`, `?lang=en`, `?file=start|deep|yaml` ja
`?broken=1` valitsevat alkutilan; samat ovat palkin valinnoissa.

```
node rounds/2026-11-15-frontmatter-preview/build.mjs <out>
node rounds/2026-11-15-frontmatter-preview/check.mjs <out>/offline.html <out>/shots [--quick]
```

## Nykytila tarkasti

`web/src/components/frontmatter.ts` jakaa lohkon ylätason avaimiin. Arvo on
tekstiä, kun se on skalaari tai `|`/`>`-lohko, ja kaikki sisäkkäinen (lista,
mappi) jää `yaml`-lähteeksi. `MarkdownRenderer.tsx` näyttää sen `<pre>`:nä
avaimen vieressä. Esitys siis luovuttaa **ensimmäisen tason jälkeen**:
start pagen `goals` on yksi monospace-lohko. Jos yksikin ylätason rivi ei
ole `avain: arvo` -muotoa (esimerkiksi flow-mappi `{…}` ylätasolla tai
tunnistamaton lainaus), koko lohko näytetään raakana. `.yaml`/`.yml`
-tiedostoilla ei ole esikatselua lainkaan (`editorPreview.ts`: ”JSON, YAML
and code have none: folding already shows their structure”), joten
esikatselupainike puuttuu.

## Suositus

**3 Sivuna aloitussivulle ja sen pohjana 1 Sisäkkäin kaikelle muulle, myös
`.yml`-tiedostoille.** Aloitussivun lukija kysyy, miltä sivu näyttää ja
kelpaako se. Tunnistettu esitys vastaa molempiin, ja se on tiedosto, jota
agentti meillä nimenomaan kirjoittaa. Yleisessä tapauksessa sisäkkäinen
luettelo näyttää kaiken ilman klikkauksia, ja tekstinäkymä on jo
taitettava puu, joten 2 Puu toistaisi sen. Puun taulukko on hyvä
samanmuotoisille riveille, mutta pitkät kentät (prompt, what) jäävät
riviltä piiloon juuri silloin, kun niitä halutaan lukea.

Toteutus tarvitsee YAML-jäsentimen selaimeen. Nykyinen käsin kirjoitettu
lukija ei tue sisäkkäisyyttä. Ehdotus: `yaml`-paketti (eemeli/yaml)
laiskasti ladattuna esikatselun mukana, core-skeema, ei omia tageja ja
alias-raja. Tämä on uusi merkittävä riippuvuus, joten se on Jarin päätös
(issuen result.md). Kelpoisuus selaimessa toistaisi daemonin säännöt
(`start_page_linux.go`). Vaihtoehto on, että daemon jäsentää editorin
puskurin samalla funktiolla. Se on uusi daemon-rajapinta mutta ei uusi
valta, koska käyttäjän oma daemon lukee käyttäjän antaman tekstin.

## Pitäisikö aloitussivun olla `start-page.yaml`?

**Ei.** Suositus on pitää `.agents/start-page.md`.

- **Runko on oikeaa sisältöä.** Markdown-runko on sivun vapaa teksti
  (enintään 16 KiB). Työtilan sivu näyttää sen ensimmäisen kappaleen
  työtilan kuvauksena ja loput Näytä koko esittely -painikkeen takana, ja
  uuden keskustelun alku näyttää koko rungon (`WorkspaceIntro.tsx`,
  `StartHere.tsx`). Skilli käskee laittamaan turvallisuushuomion juuri
  ensimmäiseen kappaleeseen. YAML-tiedostossa runko olisi `intro: |`
  -lohkoskalaarina: Markdown sisennettynä YAMLin sisällä, ilman editorin
  Markdown-korostusta, ja sisennysvirhe rikkoisi koko sivun.
- **Sama muoto kuin taidoilla.** Sama skilli kirjoittaa jokaiselle
  tavoitteelle `SKILL.md`:n, joka on myös Markdown + front matter.
  Agentit ja ihmiset tuntevat muodon (Hugo, Jekyll, Agent Skills).
- **Kipu oli esikatselu, ei muoto.** Tunnistettu esikatselu (suunta 3)
  korjaa lukemisen, ja sivu ilman runkoa on jo nyt kelvollinen `.md`
  (runko on valinnainen).
- **Siirtymän hinta.** Lukija `readStartPageFile` ja jäsennin, skillin
  tiedostomuoto-osio ja esimerkit, testit (Go, web, browser-specit,
  lab-fixturet ja contract-skenaariot; polkuun viittaa 11 tiedostoa) sekä
  jokainen olemassa oleva repo: tämä repo itse ja pilottien repot. Kaksi
  rinnakkaista nimeä tarkoittaisi järjestyssääntöä ja kahta totuutta.
  Yksi nimi tarkoittaa rikkovaa muutosta. GitHubin koodihaku ei löytänyt
  julkisia `.agents/start-page.md`-tiedostoja, joten ulkoinen hinta on
  nyt pieni, mutta niin on hyötykin.

Jos runko joskus poistuisi tuotteesta kokonaan, kysymys kannattaa avata
uudelleen. Silloin siirtymä tehtäisiin yhdellä kertaa ilman rinnakkaista
muotoa.
