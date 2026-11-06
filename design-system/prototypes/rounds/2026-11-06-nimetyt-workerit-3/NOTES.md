# Nimetyt workerit – kierros 3: Avustajat-sirun ikoni

- **1 Botit**: kaksi agentin päätä limittäin, kuten tuotannon Käyttäjät-ikoni on kaksi henkilöä; avustajia on joukko.
- **2 Silmukka**: Workerit-pallon haaraikoni, jonka haara palaa päälinjaan ja jonka silmukalla on worker; kierros palaa mainiin.
- **3 Nimilappu**: agentin pää ja nimilappu; nimetty agentti erottuu nimettömästä kertaworkerista.

Issue `proto-named-workers`. Jari 6.11. valitsi kierroksen 2 suunnan
**3 Avustajat**: yksi Avustajat-siru Workerit-pallon vieressä, joka kertoo
avustajien tilan merkein ja avaa niiden listan. Kierroksessa 2 sirussa oli
lainattu tuotannon Agentti-ikoni (`agent`). Tällä kierroksella sirulle
haetaan oma ikoni. Akseli on ikonin muoto; muu on kierroksen 2 suunta 3
sellaisenaan: sama tarina, samat merkit, sama lista ja sama `WorkerView`.

## Ikonit

Jokainen ikoni on piirretty tuotannon `Icon`-komponentin säännöillä:
24 × 24 -ruudukko, viiva 1,8, pyöreät päät ja liitokset, ei täyttöä. Ikoni
voi siis siirtyä `web/src/components/Icon.tsx`:ään yhtenä uutena nimenä.
Sirussa se on tuotannon pallon ikonin kokoinen (14 px, `ah-bg-kind-ic`), ja
tilattomana (kaikki odottavat, ei uutta raporttia) se on himmeä kuten
tuotannon pallon ikoni.

- **1 Botit** tuplaa `agent`-pään samalla tavalla kuin `users` tuplaa
  `user`in: etummainen pää kokonaan, takimmainen vain ääriviivana. Kertoo,
  että sirun takana on joukko agentteja.
- **2 Silmukka** pitää Workerit-pallon `branch`-ikonin yläsolmun ja
  päälinjan, mutta haara kiertää takaisin päälinjaan, ja silmukan kärjessä
  on worker. Kertoo, että avustaja tekee kierroksen omassa haarassaan ja
  palaa mainiin. Lähin sukulainen pallolle; ensimmäinen versio (päälinja ja
  D-kirjaimen muotoinen kaari) näytti 14 px:ssä lipulta ja hylättiin.
- **3 Nimilappu** on `agent`-pää ja sen oikeassa alakulmassa nimilappu,
  jossa on rivi tekstiä. Kertoo, että tällä agentilla on nimi, toisin kuin
  kertaworkerilla.

Ikoni näkyy kahdessa paikassa: sirussa ennen tilamerkkejä ja avustajalistan
otsikossa, kuten tuotannon paneelin välilehdillä on lajinsa ikoni.
Tarkistuspalkissa on ikoniarkki: ikoni 14, 16, 18 ja 24 px:n kokoisena ja
tuotannon ikonit, joiden rinnalla se elää (Workerit, Prosessit, Agentti,
Käyttäjät). Puhelimessa arkissa on vain 14 ja 24 px.

## Tilat sirussa

Merkit ovat kierroksen 2 (tuotannon nauhan sanasto): paikallaan oleva
rengas odottaa, pyörivä rengas on pääagentilla (*Pääagentti välittää
viestiä*), hengittävä piste työskentelee, ja rengas, jonka keskellä on
piste, on uusi kierrosraportti, jota henkilö ei ole vielä katsonut. Ikoni
ei itse vaihda tilaa; tila on merkeissä, kuten tuotannon pallossa.

## Tarina

Sama kuin kierroksessa 2: Prototyyppari ja Katselmoija odottavat,
henkilö kirjoittaa pääagentille *riffaa A1:tä oikeilla
kuvakaappauksilla*, pääagentti välittää (merkki pyörii), Prototyyppari
työskentelee, kierroksen 3 raportti tulee (rengas pisteellä), henkilö avaa
avustajan keskustelun ja palaa, ja lopettaa Prototyypparin. Alusta-painike
aloittaa alusta.

## Mistä sivu on tehty

Tuotannon `AppShell`, `WorkspaceRail`, `AgentNavItem`, `AgentHeader`,
`ConversationTimeline`, `Composer`, `BackgroundStrip` muuttamattomana ja
`WorkerView`. Kierroksen omia ovat sirun ikonit, ikoniarkki ja kierroksen 2
siru ja lista, jotka lisätään tuotannon nauhan omaan riviin ja paneeliin ja
jotka käyttävät sen luokkia. Kaikki on synteettistä.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-06-nimetyt-workerit-3/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-nimetyt-workerit-3/check.mjs \
  design-system/prototypes/dist/nimetyt-workerit-3/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen riffin tarinan läpi 1440 px:n ja 390 px:n
leveydellä (kosketus) vaaleana ja tummana. Se tarkistaa, että sirussa on
riffin ikoni 14 px:n kokoisena, että listan otsikossa on sama ikoni, että
välitys näkyy sirussa pyörivänä renkaana ja raportti täytettynä renkaana,
sekä kierroksen 2 rajat (ei paneelia kentän yllä, ei avustajarivejä
sivupalkissa, ei workerin vastausta pääkeskustelussa, ei kenttää avustajan
näkymässä). Kuvat otetaan kertoimella 2; vaiheista, joissa siru on kiinni
(oletus, välittää, työskentelee, raportti), otetaan myös lähikuva nauhasta
(`-lahi`). Konsolin on pysyttävä puhtaana (672 tarkistuspistettä).
`index.html` on sama sivu ilman upotettuja fontteja glasspadia varten.
