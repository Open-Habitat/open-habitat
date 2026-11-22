# Selauskäynnin jälki keskustelussa · 22.11.2026

Akseli: **missä agentin selauskäynti näkyy keskustelussa?** Sama synteettinen
käynti kaikissa suunnissa: `stays.example`, 4.42–4.48, 10 sivukäyntiä,
13 valmistunutta latausta ja yksi havaittu lomakkeen lähetys.

1. **Rivi / Line:** Habitatin tiivis kuittaus; erittely avautuu sen alle.
2. **Kortti / Card — suositus:** omaksi kokonaisuudekseen erotettu käynti,
   sivusto ja määrät heti näkyvillä. Ei katoa työvaiheita piilotettaessa.
3. **Työ / Work:** merkintä työkalurivillä. Säästää keskustelun tilaa mutta
   katoaa piilotettujen työvaiheiden sisään; tämän voi kokeilla.

Kielen, teeman ja esimerkkitilan valinnat säilyvät suuntaa vaihdettaessa.
Valmis / Käynnissä / Yhteys katkesi näyttävät saman käynnin eri vaiheissa.
Selain-siru avaa tuotannon `BrowserStrip`-ikkunaluettelon. Agentin välilehti
on käynnissä erikseen merkitty, valmistuessa se poistuu mutta merkintä jää.
Katkossa viimeinen tunnettu luettelo ei väitä olevansa elävä. Katselun
painike avaa vain nimetyn esimerkkipinnan, ei oikeaa selainta tai hallintaa.

## Rakentaminen

Asenna lukitut riippuvuudet `npm ci --prefix web`. Repositorion juuresta:

```sh
round=design-system/prototypes/rounds/2026-11-22-server-browser-visit-log
out=/var/tmp/agent-keep/server-browser-agent-visit-log
node "$round/build.mjs" "$out"
node "$round/check.mjs" "$out/offline.html" "$out/check"
```

Aja koneen scratch-ohjeen mukaisesti lease-lukon ja aikarajan alla.
`offline.html` sisältää fontit; `index.html` on sama sivu ilman upotettuja
fontteja sandbox-katseluun. Kumpaakaan ei commitoida. Yhteinen valitsin ja
`picker-check.mjs` ovat muuttamattomat. Pyydetyn esimerkkikierroksen
`2026-11-21-terminal-settings-2` puuttuessa rakennuksen mallina käytettiin
`2026-11-21-take-back-processes`-kierrosta.

## Tarkistuksen rajaus

36 yhdistelmää: kolme suuntaa × 1440/390 px × fi/en × päivä/yö/kontrasti.
Jokaisessa avataan erittely näppäimistöllä, latauslista, työvaiheet ja
ikkunaluettelo, vaihdetaan käynnissä → valmis → katkennut ja tarkistetaan
määrät sekä agentin välilehden merkintä. Ei ulkoisia verkkopyyntöjä,
vaakasuunnan ylivuotoa eikä selainkonsolin virheitä. 842 tarkistusta läpi.
Kuvat ovat katselmointiaineistoa, eivät automaattinen kuvavertailu.

Tuotannon selainpaneeli avattiin lisäksi synteettisessä host-labissa.
Tämä kierros ei todista tapahtumien keräystä, pysyvyyttä, native Pi -kytkentää,
latausten tallennusta tai käyttäjäeristystä. Se ei muuta tuotantokoodia,
contractia, daemonin tilaa eikä oikeuksia. Tallennusvalinnat ja avoimet
kysymykset ovat issuen `result.md`:ssä.
