# Tulos

Syy: valittu kuvake tuli sivupalkkiin vasta seuraavasta snapshotista. Sivun
otsikko näytti valinnan heti (`useWorkspaceIconWrite` piti valinnan esillä),
mutta sivupalkin kuvakkeet lasketaan isäntämallista (`workspaceIcons`), ja
siihen kuvake tuli vain uuden snapshot-luvun mukana. Elävällä reitillä luku
kestää selaimesta katsottuna sekunteja (App.tsx:n havainto noin 3 s).
Kirjoituksen aikana jo kesken ollut luku ei sisällä uutta kuvaketta, joten
sen jälkeen tarvitaan vielä yksi luku.

Birchlta (vain lukien) osat erottuvat näin. Työtilasivu avattiin klo 09:43:09.
Kuvake-ehdotusten mallikutsu (`workspace_icon_suggestions`,
`openai-codex/gpt-6-luna`) kesti 6017 ms. Tänä aikana ehdotusrivillä oli
luurankopaikat, mutta otsikon kuvakevalitsin (emojit, kirjaimet, logo,
Automaattinen) oli koko ajan käytettävissä. Mallikutsu ei estä käsin
valintaa. Valinta 🚀 klo 09:43:40: kirjoitus ja commit
(`.open-habitat.yaml`:n mtime 09:43:40.027, commit `bc41db4`) kesti
daemonissa 39 ms. Daemonin snapshotit 09:43:40.26–.73 kantoivat jo uutta
kuvaketta, ja discovery lukee työpuun tiedoston ilman välimuistia. Hidas osa
oli siis selaimen odotus seuraavaa snapshotia varten, ei kirjoitus, commit
tai daemonin discovery.

Korjaus: kuvakekirjoituksen vastaus kertoo nyt julkaisemansa invalidaation
journaalikohdan (`event_cursor`, `workspace-change.schema.json` salli kentän
jo ennestään). Sivu vie vahvistetun valinnan heti isäntämalliin uutena
`HostChange`-lajina `icon` (`web/src/app/store.ts`), samaan tapaan kuin
työtilan nimi ja näkyvyys. Sivupalkki ja otsikko näyttävät kuvakkeen
vastauksen saavuttua. Muutos pysyy voimassa, kunnes snapshot on ohittanut
kohdan, joten ennen kirjoitusta alkanut ja myöhässä saapuva luku ei palauta
vanhaa kuvaketta. Arvo tulkitaan kuten daemonin `parseIconValue`: emoji,
1–3 kirjainta isoina, logo, `auto` (logo tai johdettu glyfi). Muun kuvan kuin
logon versiota selain ei tiedä, joten sellainen jää snapshotin varaan.

Todisteet:
- `web/tests/lab-workspace-icon-setting.spec.ts`: ensimmäinen valinta
  tehdään snapshot-lukujen ollessa pidätettyinä, ja sivupalkin kuvake vaihtuu
  silti. Ilman selainmuutosta testi kaatuu sivupalkin odotukseen.
- `web/src/app/store.test.tsx`: valinta pysyy vanhemman snapshotin yli ja
  väistyy kohdan ohittaneelle; kirjaimet, `auto`, logo ja tuntematon kuva.
- `internal/daemon/workspace_icon_write_linux_test.go`: vastauksessa on
  journaalin kohta, mutta ei silloin, kun mitään ei muuttunut.

## Decisions for later review

- **Kuvake sivupalkkiin vasta vahvistuksesta, ei jo ennen vastausta.**
  Vaihtoehto: optimistinen esitys mutaatiokerroksessa jo ennen vastausta.
  Kirjoitus ja commit kestävät kymmeniä millisekunteja ja otsikko näyttää
  valinnan jo heti, joten vahvistuksesta näyttäminen on käytännössä heti
  eikä näytä kuvaketta, jota kieltäytyminen ei kirjoittanut.
- **Ehdotusrivi odottaa mallia kuten ennenkin.** Rivi näyttää mallin
  ajatellessa luurangot eikä paikallisia ehdotuksia (logo, kirjaimet,
  nimestä arvotut emojit). Valitsin käsin otsikossa ei odota mallia.
  Jätin rivin ennalleen, koska se on Jarin ja suunnittelijan sopima Sirut
  ja paikalliset ehdotukset näytetään jo, kun malli epäonnistuu. Jos 6 s
  tuntuu yhä hitaalta, vaihtoehto on näyttää paikalliset ehdotukset
  odotuksen aikana ja vaihtaa ne mallin omiin.
