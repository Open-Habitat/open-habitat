# GitHub-kortti selkeäksi – kierros 1

Issue `proto-github-card-clarity`. Suunnat, suositus ja päätökset ovat
issuen `result.md`:ssä. Tämä tiedosto kertoo, mitä kortin jokainen osa
tekee nyt, ja miten kierros on rakennettu.

## Mitä kortin osat tekevät nyt

Lähteet: `web/src/app/CodeHostSettings.tsx`,
`web/src/components/NativeDisconnect.tsx`, `web/src/text/codeHosts.ts`,
`web/src/text/inlineSettings.ts`, `App.tsx` (`reconnectGitHub`),
`internal/gateway/auth.go` (`/auth/github/start`),
`internal/gateway/github_disconnect_linux.go`,
`internal/daemon/github_disconnect_linux.go`,
`internal/nativegh/native.go` (`Disconnect`, tilan havainto).

| Osa | Mitä se oikeasti tekee | Tarvitaanko tässä |
|---|---|---|
| GH-kirjainlaatta ja otsikko "GitHub" | Tunniste. | Kyllä. |
| "Kirjautunut käyttäjänä X." | Nimeää tunnuksen, jolla palvelimen `gh` on kirjautunut (snapshotin `native_github.login`, vain kun gh toimii). | Kyllä: vastaa kysymykseen *kuka*. Lyhyemmin. |
| "Git ja gh toimivat työtiloissa." | Tilan `connected` kuvaus. Toistaa tilamerkin. | Ei erikseen; tilamerkki riittää. |
| "Selaimesta uloskirjautuminen ei poista palvelimen valtuutusta." | Totta ja turvallisuuden kannalta olennaista: gh:n token on palvelimella, ja agentit voivat käyttää sitä senkin jälkeen, kun ihminen kirjautuu selaimesta ulos. Näkyy jokaisessa tilassa, myös silloin kun yhteyttä ei ole. | Ei oletusnäkymässä. Kuuluu katkaisun yhteyteen: se on syy katkaista. |
| Tilamerkki "Yhdistetty" / "Vanhentunut" / "Ei yhdistetty" | Snapshotin `native_github.state`; daemon tarkistaa sen itse (`gh auth status`, `gh api user`). | Kyllä: vastaa kysymykseen *toimiiko*. |
| "Yhdistä GitHub uudelleen" (toimivassa tilassa) | `/auth/github/start?reconnect=1`: GitHub-kirjautuminen, jonka token **korvaa** gh:n nykyisen tokenin (`DeliverReplacing`). Pitää workflow-oikeuden, jos ihminen on sen sallinut. Hyöty toimivassa tilassa: vaihtaa vanhenevan tokenin tai korjaa käsin päätteessä sotketun kirjautumisen. | Harvoin. Ei pääpainikkeeksi toimivaan tilaan. |
| Sama painike rikkinäisessä tilassa ("Yhdistä uudelleen" / "Yhdistä GitHub") | Sama reitti; ainoa korjaus vanhentuneelle tai puuttuvalle yhteydelle. | Kyllä, pääpainikkeena. |
| Oikeudet-sirut `gist` `read:org` `repo` | Tokenin todelliset oikeudet (`X-OAuth-Scopes`). Gateway pyytää aina samat kolme; vain `workflow` vaihtelee, ja sen tila näkyy omalla rivillään. | Ei oletusnäkymässä. Lisätietoihin selkokielellä. |
| "Katkaisu poistaa … paikallisen gh-valtuutuksen, ei GitHubin OAuth-lupaa. Vaatii uuden kirjautumisen." | Kuvaa katkaisun ennen kuin siihen ryhdytään. "Vaatii uuden kirjautumisen" tarkoittaa, että katkaisu vaatii **tuoreen** GitHub-kirjautumisen (alle 5 min), ei sitä, että yhteys palautuu kirjautumalla. Lause on monitulkintainen. | Ei kortilla; vahvistusikkunaan. |
| **"Tarkista katkaisu"** | Ei esikatselu. Se on katkaisun ensimmäinen askel: `GET /api/v1/account/github/disconnect`. Gateway hylkää pyynnön (403 `reauthentication_required`), jos istunnon GitHub-kirjautumisesta on yli 5 minuuttia. Silloin näkyy "Kirjaudu ulos ja uudelleen GitHubilla ennen katkaisua (5 minuutin sisällä)". Muuten daemon tarkistaa, että gh on yhdistetty, antaa 2 minuuttia voimassa olevan havaintotunnisteen ja selain avaa vahvistusikkunan "Irrotetaanko GitHub-yhteys?". Vasta ikkunan "Katkaise paikallinen GitHub-yhteys" tekee POSTin, joka ajaa `gh auth logout` ja poistaa git-tunnistetiedon. GitHubin OAuth-lupaa (sovelluksen valtuutusta GitHub-tilillä) ei peruta. | Toiminto tarvitaan, koska se on ainoa keino saada palvelin unohtamaan token. Nimi ja kaksivaiheisuus ovat turhia: painike on oikeasti "Katkaise yhteys…", ja tuoreen kirjautumisen vaatimus voidaan hoitaa ikkunassa itsessään. |
| Rivi "GitHub Actions -työnkulut" ja kolmen virkkeen selitys | Kertoo `workflow`-oikeuden tilan (tokenin oikeudet ja ihmisen muistettu valinta) ja varoittaa, että työnkulut voivat lukea repon salaisuudet. | Kyllä, mutta lyhyemmin; varoitus on turvallisuusmerkitys, joten se jää. |
| "Ei sallittu" + "Salli GitHubissa ↗" | Uudelleenkirjautuminen `scope=workflow`-lisäoikeudella. Avautuu samassa välilehdessä; ulkoinen-ikoni lupaa uuden välilehden. | Kyllä. Ikoni pois. |
| "Sallittu" + "Poista lupa" | Kirjoittaa ensin valinnan pois päältä, sitten kirjautuu uudelleen ilman `workflow`ia. Vanhaa tokenia ei peruta GitHubissa. | Kyllä. |
| "Lupa puuttuu" + "Älä salli" / "Salli uudelleen" | Valinta on päällä, token ilman oikeutta (esim. tavallinen kirjautuminen korvasi vanhentuneen). "Älä salli" vain kirjoittaa valinnan pois. | Kyllä; selitys lyhyemmäksi. |
| "Kirjautuminen kesken" + "Peru" | Salli painettu, mutta GitHubista ei palattu (selaimen historia toi sivun takaisin). Peru vain nollaa selaimen tilan. | Kyllä. |
| Katkaisun jälkeinen ilmoitus | "Paikallinen gh-valtuutus poistettu. GitHubin OAuth-lupaa ei peruttu." | Kyllä, sanoin "yhteys katkaistu tältä palvelimelta". |

Muut tilat (`unreachable`, `verifying`, `partial`, `unknown`) seuraavat
samaa kaavaa: tilasana merkissä ja yksi virke. Niitä ei piirretä tällä
kierroksella.

## Rakenne

Sivu on asetussivun runko (`s-page`, `s-main`, joten kortin
konttikyselyt toimivat kuten tuotannossa) ja seitsemän tilannetta
allekkain. **Nyt** on tuotannon `CodeHostSettings` muuttamattomana; vain
Gitean, GitLabin ja tuotujen työtilojen osiot on piilotettu. Sen
"Tarkista katkaisu" saa sijaisdaemonilta 403-vastauksen, kuten useimmiten
oikeastikin. Suunnat 1–3 on koottu tuotannon palasista (`LetterMark`,
`StatusMark`, `ControlButton`, `Button`, `Menu`, `Icon`, react-arian
ikkuna) ja asetussivun luokista (`s-card`, `s-row`, `s-marked`, `s-lbl`,
`s-val`, `s-desc`, `s-more`, `s-editor`, `s-wf-row`). Suuntien painikkeet
toimivat sijaistilassa: GitHub-kirjautuminen on hetken mittainen
"Siirrytään GitHubiin" -tila, ja katkaisun vahvistusikkuna toimii molemmilla
poluilla (kirjautuminen vanha → vahvista GitHubilla, tuore → katkaise).

`text.ts` on kierroksen sanasto suomeksi ja englanniksi. `?theme=` ja
`?lang=en` valitsevat alkuasetukset.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-15-github-card/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 550 \
  node design-system/prototypes/rounds/2026-11-15-github-card/check.mjs \
  <out>/offline.html <kuvahakemisto> [--quick]
```
