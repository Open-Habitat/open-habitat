# Nimetyt workerit – kierros 2

- **1 Pallossa**: avustajat ovat Workerit-pallossa omina merkkeinään, ja pallon paneelissa niillä on oma ryhmä kertaworkerien yllä.
- **2 Sirut**: jokainen avustaja on oma sirunsa pallon vieressä nimellä ja tilamerkillä; siru avaa kortin, jossa ovat kierrokset.
- **3 Avustajat**: yksi Avustajat-siru pallon vieressä kertoo kaikkien tilan merkein ja avaa niiden listan.

Issue `proto-named-workers`. Jari 6.11.: kierros 1 lähti väärään suuntaan.
Nimetyt workerit kuuluvat nykyiseen Workerit-palloon kirjoituskentän luona
tai toiseksi palloksi, siruksi, sen viereen. Ei paneelia kentän yllä, ei
rivejä sivupalkissa, ei workerin vastauksia pääkeskustelussa eikä kenttää,
jolla kirjoitetaan workerille. Mekanismista on päätetty
(`design-named-workers`): Taskfleet omistaa nimetyn workerin, se tekee
kierroksen ja jää odottamaan, henkilö puhuu vain pääagentille, joka välittää
viestin, main yhdistetään workerin haaraan ennen jokaista viestiä, ja
jokaisen kierroksen työ yhdistetään mainiin.

Sivu kutsuu nimettyä workeria **avustajaksi**, jotta se erottuu
kertaworkerista samassa pallossa.

## Mistä sivu on tehty

Tuotannon komponentit: `AppShell`, `WorkspaceRail`, `AgentNavItem`,
`AgentHeader`, `ConversationTimeline`, `UserMessage`, `AssistantMessage`,
`Composer` ja ennen kaikkea **`BackgroundStrip` muuttamattomana**: Workerit-
pallo, sen kelluva paneeli ja kertaworker
`sharepoint-skipped-sites-recover`, jota agentti ei odota (katkoviivarengas).
Avustajan oma keskustelu on tuotannon **`WorkerView`**: vain luku, ei
kenttää, nauhassa *Vain luku · kysy pääagentin kautta*, pääagentin viestit
`WorkerBrief`-kuplina (*Pääagentti · tehtävä*) ja kierrosten yhdistämiset
`PiBoundary`-merkintöinä.

Kierroksen omia ovat avustajien merkit, rivit, sirut, kortti ja lista. Ne
lisätään tuotannon nauhan omaan riviin ja paneeliin (React-portaali
`BackgroundStrip`in DOMiin), ja ne käyttävät tuotannon nauhan luokkia
(`ah-bg-row`, `ah-bg-badge`, `ah-bg-pop`, `ah-bg-ring`, `ah-bg-dot`).
Prosesseja ei ole, joten Prosessit-palloa ei näy. Kaikki on synteettistä.

## Merkit

Merkit ovat tuotannon nauhan sanastoa:

- **hengittävä piste**: avustaja työskentelee (kierros työn alla);
- **pyörivä rengas**: asia on pääagentilla (*Pääagentti välittää viestiä*,
  *Lopetetaan…*), sama merkitys kuin tuotannon Kerro agentille -pyynnöllä;
- **paikallaan oleva rengas**: avustaja odottaa pääagenttia (tuotannon
  `waiting_parent`, *Odottaa pääagenttia*);
- **rengas, jonka keskellä on piste**: uusi kierrosraportti, jota henkilö ei
  ole vielä katsonut (*Kierros 3 raportoitu*). Piste häviää, kun henkilö
  avaa avustajan keskustelun;
- **väkänen**: lopetettu, rivi taittuu pois kuten tuotannon poistuva rivi.

## Tarina

Kapellimestarin keskustelussa *Rupeama 6.11.* (open-habitat) on kaksi
avustajaa: **Prototyyppari · M365-asetus** on toimittanut kaksi kierrosta
(molemmat mainissa), ja **Katselmoija · SharePoint-korjaus** on raportoinut
kierroksen 1. Kumpikin odottaa. Pääagentti on kertonut kierroksesta 2
omin sanoin.

1. Henkilö kirjoittaa kenttään pääagentille *riffaa A1:tä oikeilla
   kuvakaappauksilla*.
2. Pääagentti työskentelee (*Välitän viestiä prototypparille…*), ja
   prototypparin merkki pyörii: *Pääagentti välittää viestiä · main
   päivitetään haaraan*.
3. Pääagentti kertoo keskustelussa, mitä se välitti (lainaus), ja
   prototyyppari työskentelee: *Kierros 3 työn alla · sai 10.31: …*. Lopeta
   on poissa käytöstä ja kertoo syyn.
4. Raportti tulee: merkki on rengas pisteellä, ja pääagentti kertoo
   raportin omin sanoin ja välittää prototypparin kysymyksen henkilölle.
   Raportti itse ei tule pääkeskusteluun.
5. Avustajan rivi tai *Näytä keskustelu* avaa sen keskustelun
   (`WorkerView`): tehtävät, raportit, *main päivitetty haaraan ennen
   viestiä* ja *Kierros N yhdistetty main-haaraan*. Nauhan *Rupeama 6.11.*
   palaa takaisin.
6. *Lopeta* lopettaa avustajan. Kaikki kierrokset ovat jo mainissa, joten
   lopetus poistaa vain worktreen ja haaran. Rivi näyttää *Lopetettu ·
   kaikki kierrokset mainissa* ja taittuu pois. Katselmoija jää.

## Suunnat

- **1 Pallossa.** Pallossa on tuotannon merkkien perässä ohut erotin ja
  avustajien merkit. Pallon paneelissa on Workerit-välilehden yläosassa
  ryhmä *Avustajat 2* (*jäävät odottamaan; viestit pääagentin kautta*),
  rivi per avustaja ja sen alla *Kertaworkerit*. Rivi avaa avustajan
  keskustelun, ja *Lopeta* on rivin lopussa.
- **2 Sirut.** Pallon vieressä on siru per avustaja: tilamerkki ja nimi,
  ja uuden raportin aikana *kierros 3* (puhelimessa vain merkki). Siru
  avaa kortin pallon paneelin paikalle: tila, agentti ja profiili,
  kierrokset numeroituina (*mainissa 2b511e1*), pääagentin viimeisin viesti
  sanatarkasti, *Näytä keskustelu* ja *Lopeta*.
- **3 Avustajat.** Pallon vieressä on yksi siru *Avustajat* ja merkki per
  avustaja. Se avaa listan, jossa on samat rivit kuin suunnassa 1, ja
  lopussa lause siitä, miten avustajat toimivat.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-06-nimetyt-workerit-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-nimetyt-workerit-2/check.mjs \
  design-system/prototypes/dist/nimetyt-workerit-2/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen suunnan tarinan läpi 1440 px:n ja 390 px:n
leveydellä (kosketus) vaaleana ja tummana. Se tarkistaa, ettei sivulla ole
paneelia kentän yllä, avustajarivejä sivupalkissa, workerin vastausta
pääkeskustelussa eikä kenttää avustajan näkymässä. Kuvat otetaan
kertoimella 2, ja konsolin on pysyttävä puhtaana (496 tarkistuspistettä).
`index.html` on sama sivu ilman upotettuja fontteja glasspadia varten.
