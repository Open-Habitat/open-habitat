# GitHubin työnkulkulupa – kierros 1

Issue `github-workflow-scope-from-settings`. Suunnat, suositus ja
kysymykset ovat issuen `result.md`:ssä.

Sivu on tuotannon kehys (`AppShell`, `WorkspaceRail`) ja koko tuotannon
`AccountSettings` Koodipalvelut-osiossaan (`CodeHostSettings`)
muuttamattomana, GitHub yhdistettynä. Kierroksen palat on koottu tuotannon
palasista (`ControlButton`, `StatusMark`, `Checkbox`, `Icon`, react-arian
ikkuna) ja asetussivun luokista (`s-row`, `s-marked`, `s-lbl`, `s-val`,
`s-model-chips`, `s-editor`). Ne viedään portaalilla tuotannon
GitHub-kortille (`useSlot`, kuten kierroksessa `2026-11-10-hakuavain`).
github.com on merkitty sijainen-ikkuna, joka näyttää pyydetyt oikeudet.
Tuotannon oma Yhdistä GitHub uudelleen -painike toimii suunnissa A ja B ja
pyytää workflow-oikeutta, jos ihminen on sen sallinut. C korvaa sen omalla
ikkunallaan.

Suunnat: A Rivi (oma rivi kortissa, oikeudet siruina), B Luettelo (jokainen
oikeus selkokielellä, workflow viimeisenä) ja C Ikkuna (valintaruutu
Yhdistä uudelleen -ikkunassa). `text.ts` on kierroksen sanasto suomeksi ja
englanniksi. `?s=pois|kaynnistyy|paalla|kadonnut|tuntematon` ja
`?theme=dark` valitsevat alkutilan.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-13-github-workflow-scope/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 550 \
  node design-system/prototypes/rounds/2026-11-13-github-workflow-scope/check.mjs \
  design-system/prototypes/dist/github-workflow-scope/offline.html <kuvahakemisto>
```

`web/node_modules` tarvitaan lukitiedoston mukaisena (`npm ci --prefix web`).
`offline.html` on yksi itsenäinen tiedosto fontteineen. Tarkistus käy kolme
suuntaa ja viisi tilannetta 1440 ja 390 px:n leveydellä, vaaleana ja
tummana, ja klikkaa salli-, peru-, poista-, älä salli- ja
uudelleenyhdistämispolut. Konsoli on puhdas.

## What the host would need

Nykytila: gateway pyytää aina `repo read:org gist`
(`GitHubProvider.AuthorizationURL`, `internal/gateway/github.go`).
Tavallinen kirjautuminen olemassa olevalle tilille pitää gh:n toimivan
valtuutuksen (`Deliver`), ja vain oman istunnon nimenomainen
uudelleenyhdistäminen (`/auth/github/start?reconnect=1`, `DeliverReplacing`,
`internal/gateway/auth.go`) korvaa sen. Daemon kysyy gh:lta `gh auth
status` ja `gh api user` (`internal/nativegh`), mutta ei lue oikeuksia.

**Gatewayn scope-parametri.** `AuthorizationURL` saa lisäoikeudet
parametrina. `/auth/github/start` hyväksyy `scope=workflow` vain yhdessä
`reconnect=1`:n kanssa, samalla vartijalla kuin uudelleenyhdistäminen (vain
istunnon oma tili). Sallittujen lisäoikeuksien lista on kiinteä: nyt vain
`workflow`. Selain voi pyytää lisäoikeutta, koska se vain laajentaa sitä,
minkä ihminen itse hyväksyy GitHubissa. Sallinta ei siirrä valtaa
komponentilta toiselle. Callback lukee GitHubin token-vastauksen
`scope`-kentän, joka kertoo myönnetyt oikeudet. GitHubin ehdotonta
käytöstä ei pidä olettaa: kun pyydetään vähemmän kuin aiemmin myönnettiin,
GitHub saattaa ohittaa hyväksyntäsivun ja antaa vain pyydetyt oikeudet.
Tämä on tarkistettava oikealla OAuth-sovelluksella, ennen kuin "Poista
lupa" toteutetaan uudelleenyhdistämisenä.

**Miten daemon lukee valtuutuksen oikeudet.** GitHub palauttaa
klassisen OAuth-tokenin oikeudet jokaisen API-vastauksen
`X-OAuth-Scopes`-otsakkeessa. Daemonin olemassa oleva `gh api user`
-tarkistus saa sen samasta pyynnöstä `--include`-valitsimella, joten uutta
pyyntöä ei tarvita. (`gh auth status` tulostaa saman "Token scopes" -rivinä,
mutta muoto on tarkoitettu ihmiselle.) Snapshotin `native_github` saa kentän
`scopes`: lista, kun otsake luettiin, ja `null`, kun ei luettu. `null`
tulee, kun tila ei ole `connected` tai tarkistus päättyi `unknown`-tilaan.
Se tulee myös, kun tokenilla ei ole otsaketta (hienojakoinen tai GitHub
App -tunnus). Kortti näyttää silloin "ei tiedossa". Muutos alkaa skeemasta
`contracts/v1/`.

**Pitääkö vai pudottaako myöhempi tavallinen kirjautuminen luvan.**

- Tavallinen kirjautuminen, kun gh:n valtuutus toimii: lupa säilyy, koska
  gh:n valtuutus säilyy. Uusi perusoikeuksinen token jää käyttämättä ja
  perutaan, kuten nyt (`HandoffUnused`).
- Tuotannon Yhdistä uudelleen: pyytää workflow-oikeutta, jos ihminen on
  sen sallinut. Lupa säilyy.
- Tavallinen kirjautuminen, kun gh:n valtuutus on vanhentunut tai poissa:
  gateway ei tiedä ennen kirjautumista, että ihminen oli sallinut luvan.
  Uusi token saa perusoikeudet, ja lupa putoaa. Sama käy, kun ihminen ajaa
  päätteessä `gh auth login` tai `gh auth refresh` ilman `-s workflow`.
  Näitä varten on tila "Lupa puuttuu".

Tila "Lupa puuttuu" vaatii, että ihmisen valinta on muistissa erillään
tokenista. Kierros olettaa yhden totuusarvon ihmisen omissa Habitat-
asetuksissa, jotka daemon lukee ja kirjoittaa hänen käyttäjänään.
Myönnetyistä oikeuksista totuus on yhä token. Totuusarvo kertoo vain, mitä
ihminen haluaa, ja selain lähettää sen perusteella `scope=workflow`
uudelleenyhdistämisessä. Ilman sitä kortti näyttää pudonneen luvan tilana
"Ei sallittu", ja ainoa merkki on epäonnistunut push. Tämä on kysymys
Jarille (`result.md`).

**Vanhan tokenin peruminen.** Kun lupa poistetaan, gh:n uusi valtuutus
korvaa workflow-tokenin, ja vanha token jää GitHubiin käyttämättömänä.
Gateway osaa perua vain tokenin, jonka se itse juuri sai. Vanhan tokenin
peruminen vaatisi, että daemon antaa gh:n tokenin gatewaylle, eli
valtuutus kulkisi rajan yli. Kierros ei peru sitä eikä väitä perineensä.
