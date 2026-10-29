# Tulos: oma kone agentin käyttöön (Ohjattu)

Koko issue tehtiin tässä ajossa. Keskustelun puolen osat (konesiru `ssh`-riveillä,
"Yhteys auki" keskustelun otsikossa) ja Windows-ohje jäivät; ne on kirjattu
intake-issueksi `very-proud-trick`.

## Mitä tehtiin

- **Ajoprofiili.** `integrations`-profiili tuo Tailscalen viralliset staattiset
  binäärit `tailscale` ja `tailscaled` 1.104.4 (amd64 ja arm64, arkiston ja
  tiedostojen SHA-256 lukittu, Go-moduulien lisenssit
  `tailscale*-THIRD-PARTY-NOTICES`). Host apply vaatii ne suljetussa
  profiilissa kuten sopsin.
- **Daemon** (`internal/daemon/own_machines_linux.go`, reitti
  `/api/v1/own-machines`, gateway välittää istunnolla ja CSRF:llä):
  - kirjoittaa ja käynnistää käyttäjäyksikön
    `~/.config/systemd/user/habitat-tailscale.service`: userspace-verkko,
    soketti vain yksikön `RuntimeDirectory`yyn (0700, `$XDG_RUNTIME_DIR`),
    ei TCP-porttia, ei SOCKS- tai HTTP-välitintä;
  - asetukset tulevat **lukitusta** `tailscaled --config` -tiedostosta:
    shields up, ei DNS:ää eikä reittejä tailnetistä. Lukitus estää myös
    `tailscale set --shields-up=false`:n, ja jokainen käynnistys asettaa ne
    uudelleen;
  - välittää Tailscalen kirjautumislinkin (vain `https://login.tailscale.com/a/…`),
    lukee LocalAPI:sta laitteen, verkon ja laitelistan (nimet MagicDNS:stä);
  - tekee rivin `restrict,from="<oma 100.x>",expiry-time="…" ssh-ed25519 … habitat:<tili>@<sivusto>`
    ja asennuskomennon, joka korvaa vain tämän tilin aiemman rivin;
  - tarkistaa yhteyden kertakäyttöisellä known_hostsilla, tallentaa koneen
    vasta kun kone hyväksyy avaimen ja näyttää saman isäntäavaimen, jonka
    ihminen vertasi; tallennettu kone tarkistetaan vain kiinnitettyä
    avainta vasten;
  - koneet ovat ihmisen omaa SSH-asetusta: `~/.ssh/config.d/habitat-<nimi>.conf`
    ja `.known_hosts`, `Include` lisätään `~/.ssh/config`in alkuun (linkkiä ei
    muuteta, sivu näyttää silloin lisättävän rivin). Agentti käyttää konetta
    tavallisella `ssh <nimi>`;
  - uusiminen, poisto ja irrotus (yksikkö pysäytetään ja todennetaan
    pysähtyneeksi ennen kuin tila, avain ja koneet poistetaan).
- **Selain**: Asetukset › Omat koneet (`/settings/machines`, Tiedot
  agenteille -osion jälkeen). Sivu on yhteenveto, *Lisää kone* avaa
  viisivaiheisen dialogin (Tailscale, Kone, Etäkirjautuminen, Avainrivi,
  Vahvistus), *Uusi pääsy* avaa sen avainrivin kohdalta. Kaikki prototyypin
  tilat: ei palvelimella, ei käytössä, odottaa kirjautumista/hyväksyntää,
  avainrivi puuttuu, yhdistetty, ei vastaa, ei Tailscalessa, vanhentunut,
  kone hylkää avaimen, tunniste muuttunut. Kolme suoraa lausetta näkyvät
  ennen tallennusta. Taukoa ei ole. Useampi kone: *Lisää toinen kone*.
- **Agentin skill** (`open-habitat skill print agent`, osio *The person's own
  machines*) ja `host-context.md`; `docs/operations.md` (root voi käyttää
  pääsyä); `internal/AGENTS.md`:n sääntö.

## Todisteet

- `go test ./internal/daemon` (koko paketti) vihreä; omat testit kulkevat
  koko polun väärennettyä LocalAPI:a ja ssh:ta vasten, tarkistavat vastaukset
  sopimusta vasten ja ajavat generoidut asennus- ja poistokomennot `sh`:lla.
- **Toisen UID:n todiste**: `./scripts/test-tailscale-uids.sh` ajaa lukitun
  1.104.4-`tailscaled`:n daemonin omalla komentorivillä ja asetuksilla
  verkottomassa kontissa: toinen käyttäjä saa `permission denied` statukselle,
  `nc`-yhteydelle, prefsille ja set:lle; shields up pysyy ja omistajan oma
  `set --shields-up=false` hylätään; omistajalla ei ole TCP-kuuntelijaa.
- **Elävä käyttäjäyksikkö Birchlla** (oma tili, erillinen yksikön nimi,
  järjestelmän tailscaled 1.104.2, siivottu): RuntimeDirectory 0700, soketti
  0666 sen sisällä, lukittu shields-up, kirjautuminen antaa AuthURL:n (ei
  avattu), toinen host-UID (`podman unshare setpriv`) saa permission denied,
  pysäytys poistaa hakemiston.
- Selain: `own-machines.spec.ts` (koko polku, kaksi konetta, epäsopiva
  sormenjälki, peruttu ja uusittu pääsy, muuttunut isäntäavain, poisto,
  irrotus, puhelin, axe) ja `settings-search.spec.ts` vihreät; web-tarkistukset
  (946 testiä), gateway, host, sopimukset vihreät.
- Katselmointi: `/llm-review` (GPT-6 Astra etsi, Claude Fable 5.1 yritti
  kumota). Viisi löydöstä, kaikki vahvistettu ja korjattu testeineen:
  vanha ControlMaster-yhteys kelpasi uudelleen lisätylle samannimiselle
  koneelle; irrotus poisti tilan todentamatta pysähtymistä; komennot
  saattoivat korvata `authorized_keys`in lukuvirheen jälkeen; konetta ei voinut
  poistaa laitteen ollessa pysähdyksissä; vanheneminen näytettiin päivän
  myöhässä.

Ei kokeiltu: oikea tailnet-kirjautuminen, `tailscale nc` ProxyCommandina
elävää konetta vasten, shields-up elävää saapuvaa yhteyttä vastaan, oikea
Macin etäkirjautuminen. Ne ovat Jarin kokeilu testikoneella (KOKEILTAVAA).

## Fleetrepo

Ei muutoksia. Julkaisu ei lisää järjestelmän systemd-yksiköitä eikä
socketteja; käyttäjäyksikön kirjoittaa ihmisen daemon hänen kotiinsa.
Testikone tarvitsee vain sen, mitä sillä jo on: broker ottaa lingeringin
käyttöön hyväksytyille tileille, ja päivitys tuo profiilin uudet binäärit.
Testikoneelta tarvitaan ulospäin UDP/HTTPS Tailscaleen.

## Decisions for later review

1. **Tilin avain `~/.ssh/id_ed25519`, ei konekohtaista avainta.**
   Prototyypin tulos ehdotti `~/.ssh/habitat_<kone>`, mutta issue ja brief
   sanoivat käytä tilin avainta (`account-keys-page`). Valitsin tilin avaimen:
   rajaus on koneen rivissä (`from=`, `expiry-time=`), ja poisto Habitatista ei
   koskaan ollut varma katkaisu. Puuttuva avain tehdään rivin pyynnön
   yhteydessä samalla koodilla kuin Avaimet-sivulla.
2. **Tailscale `integrations`-profiiliin, ei omaa `tailscale`-profiilia.**
   Vaihtoehto oli tutkimuksen S1 oma profiili. Valitsin olemassa olevan,
   joka on jo jokaisella asennuksella pakollinen (sops-malli): ei uutta
   profiilin elinkaarta Fleetrepoen.
3. **Lukittu `--config`.** Shields-up ei ole lippu; prefsin muutos olisi
   ollut käännettävissä `tailscale set`illä. Hinta: lukittu laite ei voi
   `tailscale logout`. Irrota pysäyttää laitteen ja poistaa sen avaimen tililtä;
   laite jää Tailscalen hallintasivulle, ja sivu kehottaa poistamaan sen sieltä.
4. **Käyttäjätunnus koneella kysytään** (vaihe 2). Prototyyppi oletti sen;
   Macin tunnus on usein eri kuin Habitatin.
5. **Laitteen nimi Tailscalessa `habitat-<tili>`**; koneen nimi on sen
   MagicDNS-nimen ensimmäinen osa.
6. **Tarkistus vain napista**, ei automaattisesti sivua avattaessa: jokainen
   tarkistus on kirjautuminen ihmisen koneelle. Tila muuten Tailscalen
   paikalla/ei-tiedosta ja päivämäärästä.
7. **Rivin kommentti `habitat:<Unix-tili>@<sivusto>`** kulkee sopimuksessa
   (kuten Avaimet-sivun avainkommentti), jotta komento korvaa vain tämän
   tilin rivin samalla koneella.
8. **Asennus- ja poistokomennot tekee daemon**, ei selain.
9. **ControlMaster 10 min** ajonaikaisessa hakemistossa; "Yhteys auki" sen
   soketista. Yhteys suljetaan, kun kone poistetaan tai tallennetaan uudelleen.
10. **Vanhenemispäivä on ensimmäinen hylätty päivä** (sshd:n `expiry-time`
    päivämäärällä alkaa keskiyöstä). Kone tulkitsee sen omalla aikavyöhykkeellään.
11. **Uusimisen kesto valittavissa** (7/30/90, oletus 30), ei ikuista.
