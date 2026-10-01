---
created: 2026-10-01
updated: 2026-10-01
type: bug
reporter: Jari
status: untriaged
priority: high
provenance: chat
source_ref: chat:2026-10-01:pilot14-login-jari
---

# Pilot.14: istunnon tarkistuspeite palaa ikkunaan palatessa ja Pi-keskustelun ohjaus katkeaa

## Description

## Käyttäjän havainto (Jari, pilot.14, 2026-10-01)

Kirjautumisen jälkeen `omega-habitat-test.example.test`-sivu vaihteli pitkään näkymien "Ladataan työtiloja…", "Agent Host — Varmistetaan istuntoa…" ja oikean työtilanäkymän välillä. Välissä vilahti OpenAI-kirjautuminen. Ongelma jatkui yli puoli tuntia, ei vain ensimmäisen latauksen ajan. Oikea työtilanäkymä ilmestyy välillä, mutta ikkunasta pois ja takaisin siirryttäessä täysruutuinen istunnon varmistuspeite ilmestyy taas. Käyttäjä tarkensi, että vasemmassa palkissa pystyy klikkailemaan ja näkymä päivittyy, kun ikkuna pysyy etualalla; aiempi "mikä tahansa klikkaus" koski erityisesti toiseen ikkunaan / DevToolsiin siirtymisen jälkeistä paluuta. Älä siis käsittele foreground-klikkauksia automaattisena laukaisijana ilman uutta näyttöä.

Kun käyttäjä pääsi painamaan "Aloita uusi Pi-keskustelu", näkymässä oli hetken vain "Uusi keskustelu". Noin puolen minuutin kuluttua siinä näkyi "Vain luku", "Live-yhteys katkesi — Tila ja natiivi historia tarkistetaan uudelleen. Viestiä ei lähetetä uudelleen" sekä "Yhteys katkesi tai istunto muuttui. Ohjaus on estetty kunnes tila varmistuu." Paluu tähän selainikkunaan näytti uudelleen istunnon varmistuspeitteen ja sitten "Ladataan / Haetaan työtiloja…".

## Havainnot kuvista ja lähdekoodista (raportoivan agentin lisäys, ei vahvistettu juurisyy)

- Julkaisu: `0.0.0-pilot.14`, tuotelähde `6a46bc7e27c239b8905360a1bb60ebe10b9613b0` (Fleetrepo-inventaarion nykyinen julkaisu). Käyttäjän selain on macOS; kuvan yläpalkki näyttää Safari-selaimelta, mutta tarkkaa versiota ei vahvistettu.
- Networkissa `/api/v1/onboarding/pi/status` palautti useasti HTTP 200 ja `{"pi":{"state":"usable"}}`, ~2.5–2.9 s/pyyntö; yksi pyyntö oli peruttu. Näin ollen jatkuvaa `missing`-tilaa ei ole osoitettu.
- Varmistukseen liittyvä jono näkyy toistuvasti: `status` ~2.5–3.7 s, `/auth/session` 200 ~0.3–0.7 s, `snapshot` 200 ~3.2–3.7 s, `conversations` 200 ~2.2–2.7 s. Osa pyynnöistä peruuntuu uuden tarkistuksen käynnistyessä. Tarkistuksen kesto ja koko näytön peite tekevät normaalista tabin vaihdosta käytännössä katkonaisen.
- Myöhemmässä Network-kuvassa `/events`- ja `/stream`-pyyntöjä on 428 sekä peruttuja; aiemmassa konsolikuvassa myös `/api/v1/conversations` sai kerran 428, vaikka myöhemmin sama endpoint sai toistuvasti 200. Älä tulkitse yksittäistä 428:aa pysyväksi kirjautumisen puuttumiseksi: selvitä erikseen, miksi näiden Pi-portillisten rajapintojen tuoreet tarkistukset eroavat 200 `usable` -tilasta ja miten ohjaus toipuu.
- Konsolissa on `Blocked aria-hidden on an element because its descendant retained focus` (`<h1>` on peitteen alla). Tämä on erillinen saavutettavuushavainto, ei todistettu pääsyy.
- `web/src/app/App.tsx`: tabiin paluun `blur`/`focus`/`visibilitychange` laukaisee `refresh()` → koko näytön `verifying`-peite. Julkaistussa koodissa varmennus odottaa Pi-tilaa (sekä olemassa olevalle snapshotille istuntoa) ennen kuin se hakee snapshotin; molemmat natiivitarkistukset maksavat kuvien mukaan noin 3 s. On myös 10 s timeout ja retain-polku. Tutki peräkkäisyyttä, peruttujen pyyntöjen toistumista ja fokustapahtumien käsittelyä oikeassa selaimessa. Älä poista identiteettitarkistusta tai paljasta edellisen käyttäjän DOM:ia vain nopeuden takia.
- `internal/daemon/pi_device_linux.go`: `PiDevice.StatusContext` käynnistää natiivin Node/Pi-apuprosessin jokaisessa Pi-tilatarkistuksessa; daemonin Pi-portti tarkistaa tilan uudelleen eri rajapinnoilla. Ei ole vielä todistettu, johtuvatko ~3 s ajat juuri siitä vai verkosta.
- Testipalvelimen gateway oli tutkimushetkellä aktiivinen, `NRestarts=0` ja palvelun ActiveEnterTimestamp 2026-10-01 05:57:46 UTC. Se ei todista selaimen istunnon tai daemonin jatkuvuutta.

## Toistokoe ja odotettu toiminta

Kirjaudu pilot.14-testipalvelimeen oikealla GitHub- ja Pi-tunnuksella, avaa työtilat ja siirrä fokus pois selainikkunasta (esim. DevToolsiin tai toiseen ikkunaan), sitten takaisin. Kokeile lisäksi uuden Pi-keskustelun avaamista. Tallenna vain pyyntöjen endpointit, ajat, HTTP-koodit ja Pi-tilat; ei evästeitä, CSRF-arvoja, auth-vastauksia, tokenia eikä todellista keskustelusisältöä. Odotus: sessio varmennetaan turvallisesti mutta näkymä palautuu kohtuullisessa ajassa eikä keskustelu jää perusteettomasti vain luku -tilaan tai virheiden 428 silmukkaan. Testaa myös etualan tavalliset klikkaukset erikseen, ettei tarkistusta käynnistetä turhaan.

Liitteet: rajatut kuvat istunnon peitteestä, HTTP-ajoista, `usable`-tilasta ja vain luku -keskustelusta. Alkuperäiset suuremmat kuvakaappaukset ovat käyttäjän CleanShotissa; niissä näkyy työtilojen nimiä ja URL:n tunnisteita, joten niitä ei liitetä kokonaisina.
