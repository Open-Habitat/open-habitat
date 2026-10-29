# Työtilan etusivu – opas kokeiluun

Kierros vastaa kysymykseen: mitä repon (työtilan) sivun alussa pitäisi
näkyä, ja miten se suhtautuu keskustelun aloitussivuun. Kaikissa suunnissa on
sama keksitty `aurinkokello`-repo: sama aloitussivu (`.agents/start-page.md`:n
otsikko, esittely ja neljä tavoitetta), samat neljä avointa keskustelua, joista
kaksi on workereita omissa worktreeissään, ja sama Git-tila. Mitään ei
lähetetä, eikä sivu ota yhteyttä mihinkään.

Avaa `prototypes/tyotilan-etusivu/index.html` selaimessa tai Habitatin
näkymänä. Valitsin on yläreunassa: 1–4 tai nuolet vaihtavat suuntaa, ja
R aloittaa alusta. Oikean alakulman **Säätimet** vaihtavat teemaa,
leveyttä (Puhelin 390 näyttää puhelinkehyksen) ja aloitussivun tilaa
(Kirjoitettu / Puuttuu).

## Mitä kokeilet

1. **Nyt** on tämänhetkinen työtilasivu. Paina **+**, niin näet keskustelun
   aloitussivun sellaisena kuin se on nyt: esittely ja tavoitekortit. Tähän
   muihin suuntiin verrataan.
2. Vaihda suuntaa ja paina tavoitetta, esimerkiksi **Korjaa havaittu virhe**.
   Opas aukeaa. Paina **Aloita**, niin viestikenttään tulee pyyntö, ja
   `[kuvaile havainto]` jää valituksi. Kirjoita ja lähetä.
3. Paina Git-tilaa (`main · 2 muutosta ↑1`) ja avaa esittely
   (**Näytä koko esittely** / **Lue esittely**).
4. Vaihda Säätimistä **Aloitussivu: Puuttuu**. Useimmilla repoilla ei vielä
   ole aloitussivua, joten katso, miltä kukin suunta näyttää ilman sitä.
5. Katso puhelimessa ja tummana.

## Nyt

Työtilasivulla on nimi, polku, toiminnot, Git-tila ja keskustelukortit. Repon
esittelyä tai tavoitteita ei näy, vaikka aloitussivu olisi kirjoitettu.
Ne näkyvät vasta, kun aloitat uuden keskustelun.

![Nyt](evidence/nyt-1440-light.avif)

## Esittely (suositus)

Aloitussivu näkyy myös työtilasivun alussa: otsikko, esittelyn ensimmäinen
kappale (loput **Näytä koko esittely** -painikkeen takana) ja samat
tavoitekortit kuin keskustelun alussa. Tavoite avaa uuden keskustelun suoraan
sen oppaaseen. Git-tila ja keskustelukortit ovat alla kuten nyt.

![Esittely](evidence/esittely-1440-light.avif)
![Esittely: opas uudessa keskustelussa](evidence/esittely-opas-1440-light.avif)

Ilman aloitussivua kohdalla on yksi katkoviivainen rivi, ja **Luo
aloitussivu** valmistelee keskusteluun `/open-habitat-start-page`-pyynnön.

![Esittely ilman aloitussivua](evidence/esittely-puuttuu-1440-light.avif)

## Tilannekuva

Sivu kertoo ensin, missä ollaan. Esittelystä näkyy nimen alla vain
ensimmäinen virke, ja tavoitteet ovat yhtenä nappirivinä. Pääosa on kaksi
paneelia: *Sinun vuorosi* ja *Workerit* sekä Git: muutetut tiedostot ja
viimeisimmät commitit ilman erillistä avaamista. Niiden alla ovat muut
viimeisimmät keskustelut.

![Tilannekuva](evidence/tilannekuva-1440-light.avif)
![Tilannekuva puhelimessa](evidence/tilannekuva-390-dark.avif)

## Aloitus tässä

Työtilasivu on itse aloitussivu. Esittely ja tavoitteet ovat kortissa, jossa
on oma viestikenttä. Tavoitteen opas aukeaa samaan korttiin, Aloita täyttää
kentän, ja vasta lähetys aloittaa keskustelun. +-painiketta ei tarvita.
Keskustelut ovat alla tiiviinä listana.

![Aloitus tässä](evidence/aloitus-1440-light.avif)
![Aloitus tässä: Aloitan jälkeen](evidence/aloitus-aloitettu-1440-light.avif)

## Mitä valitset

Suosittelen **Esittelyä**. Se tuo aloitussivun sinne, missä repo avataan,
eikä vaadi uutta tiedostoa eikä uutta hostin lukua: sivu lukee jo nyt
saman `.agents/start-page.md`:n ilman keskustelua. Tilannekuva on
hyödyllisempi monen workerin repossa, mutta se toistaa keskustelukorttien
tietoa ja vie esittelyn sivuun. Aloitus tässä on rohkein: se tekee
työtilasivusta ja keskustelun alusta saman, mutta silloin samat tavoitteet ja
opas ovat kahdessa paikassa ja kenttä vie tilaa keskusteluilta.

**Kysymys sinulle:** valitaanko Esittely, vai haluatko Tilannekuvan
Git- ja worker-paneelit sen alle? Päätettäväksi jäävät kohdat on lueteltu
[result.md](result.md):ssä kohdassa *Decisions for later review*.
