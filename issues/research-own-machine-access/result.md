# Result: the agent reaches the person's own computer

## Jarille

**Suositus.** Rakennetaan reitti näin:

- Jokaiselle ihmiselle oma `tailscaled` ilman rootia, userspace-tilassa,
  hänen tilinsä systemd-käyttäjäyksikkönä.
- Kone liittyy ihmisen *omaan* tailnetiin kirjautumislinkillä selaimessa.
  Meillä ei ole omaa tailnetiä eikä ylläpitäjän tunnuksia kenenkään
  tailnetiin.
- Agentti yhdistää ihmisen koneeseen tavallisella SSH:lla. Avain tehdään
  tilillä, ja ihminen lisää koneelleen yhden rivin `restrict`-,
  `from=`- ja `expiry-time=`-rajauksin.
- Macissa käytetään Remote Loginia vain omalle käyttäjälle, ja "full disk
  access" jää pois päältä.

Tuotteeseen ei tule omaa asiakasohjelmaa, välittäjää eikä konerekisteriä.
Konelista on ihmisen oma SSH-konfiguraatio.

**Kokeilu Birchlla osoitti, että tämä toimii ilman rootia.** Se löysi myös
kaksi vaarallista oletusta, jotka tuotteen pitää aina ohittaa:

1. **Sokettioikeudet.** `tailscaled` luo LocalAPI-sokettinsa `0666`-oikeuksin
   `0755`-hakemistoon. Lisäksi sen `dial`-kutsu (`tailscale nc`) ei vaadi
   kirjoitusoikeutta. Kokeilu todisti tämän toisella UID:llä: tila luettiin,
   ja `dial` meni läpi, vaikka asetusten muutos estettiin. Jos soketti ei ole
   `0700`-hakemistossa, kuka tahansa palvelimen käyttäjä pääsee ihmisen
   tailnetiin. Ratkaisu: soketti aina `$XDG_RUNTIME_DIR`:iin, eikä
   SOCKS-porttia (jota Tailscalen oma ohje neuvoo käyttämään).
2. **Saapuvat yhteydet.** Userspace-tila ohjaa tailnetistä tulevat yhteydet
   palvelimen `127.0.0.1`:een, siis kaikkien käyttäjien localhost-palveluihin.
   Lähdekoodin mukaan `--shields-up` estää tämän ennen kuin yhteys pääsee
   eteenpäin. Se on aina päällä.

Kokeilu pysähtyi kirjautumislinkkiin. Oikeaa tailnetiä ei käytetty, joten
`tailscale nc`, uudelleenkäynnistyksen kestävyys ja live-testi shields-upista
jäivät todentamatta.

**Päätät:**

1. **Agentti saa koneella kaiken, mitä ihmisen käyttäjä saa**, ilman
   kutsukohtaista hyväksyntää. Tämä on `tw`:n malli. Devinin mallin
   hyväksynnät vaatisivat oman asiakasohjelman, jonka jätit pois.
   Suosittelen hyväksymään tämän rajattuna yhteen koneeseen ja
   vanhenemispäivään (oletus 30 päivää), ja kertomaan sen käyttöliittymässä
   suoraan.
2. **Palvelimen root pääsee ihmisen koneelle.** Root voi lukea avaimen ja
   tailnet-tilan ihmisen kotihakemistosta, eikä tätä voi estää Linuxissa. Northwindilla
   tämä tarkoittaa, että sinä pääset Villen Maciin. Suosittelen kertomaan tämän
   UI:ssa ja `operations.md`:ssä eikä yrittämään piilottaa sitä.
3. **Taukonappi ei pysäytä agenttia.** Habitatin "Tauko" pysäyttää
   käyttäjäyksikön, mutta agentti toimii samalla UID:llä ja voi käynnistää sen
   uudelleen. Todellinen katkaisu tehdään ihmisen koneella: rivin poisto,
   vanheneminen, Remote Login pois tai laitteen poisto tailnetistä.
   Suosittelen, että UI sanoo tämän ääneen eikä lupaa enempää.
4. **Birch on itse tailnetissäsi koko koneena** (`tailscale0`, soketti
   `0666`). Kaikki Birchn Unix-käyttäjät ja agentit, myös Kaisan tili,
   voivat reitittää tailnetisi laitteisiin. Tämä on Fleetrepon asia (S4), ei
   tuotteen. Päätä, onko se tarkoituksellista.

**Ehdotetut jatkot** (raportin `spinoff_proposals`, ei kirjattu):

- S1: `tailscale`-ajoprofiili.
- S2: live-kokeilu kertakäyttöisellä Tailscale-tilillä. Tarvitsee sinulta
  tilin.
- S3: Mac-komentojen tarkistus oikealla Macilla. Tarvitsee luvan ja koneen.
- S4: Birchn tailnet Fleetrepossa.
- S5: toteutus, kun prototyyppi on valittu.

`proto-own-machine-access` voi alkaa raportin kohdasta 6, jossa ovat
näkymät.

## What was done

- `report.md` covers the following:
  - the spike: method, observations, and the source-level findings on socket
    modes, the `dial` permission and inbound loopback forwarding;
  - the architecture with its authority split, the native components and
    their settings, and the choice of tailnet;
  - the person's controls, and which of them actually bind the agent;
  - the agent's verbs mapped to `tw`;
  - what must never happen and what cannot be prevented;
  - the UI surfaces for the prototype round;
  - a comparison with `tw`, Devin and VS Code tunnels;
  - spinoff proposals and sources.
- The spike ran on Birch under `maintainer` only. It used the system
  `tailscale` 1.104.2 binaries, a user-run `tailscaled` under `timeout`, and a
  `systemd-run --user` unit. A second host UID came from the subuid range via
  `podman unshare setpriv`. The spike stopped at the login URL; no tailnet was
  joined and no auth key was used.
- Cleanup: every `tailscaled` started was stopped (`pgrep` empty); the
  transient units are gone. Files `tailscaled` wrote outside the scratch
  directory were removed by exact name (`~/.local/share/tailscale/*`, a literal
  `~/%t/` from an unexpanded specifier). Scratch directories under
  `/var/tmp/oh-research.*` hold only spike state and a Tailscale source
  checkout.
- Not done:
  - no real tailnet, Mac or Windows test;
  - no external model review (no such tool in this worker);
  - Birch's system `tailscaled` was only read.

## Decisions for later review

- **User unit rather than a daemon child** for `tailscaled`. It outlives
  daemon restarts and upgrades, starts at boot through lingering, and needs
  no broker signal. The alternative, the integrations `Supervisor` plus
  widening `sync-at-boot`, would change what the broker looks at.
- **Tailscale's log upload left as Tailscale ships it** (no
  `--no-logs-no-support`). `TS_LOGS_DIR` keeps the local log files in the
  account. Whether to upload logs to Tailscale is the person's privacy
  versus Tailscale support; the prototype can surface it as a setting.
- **No forced `command=`** in the first round. A useful allowlist would be our
  own client on the person's machine.
- **The person's own tailnet by default**, with tags/policy as the stricter
  option. Node sharing does not fit because a shared node cannot start
  connections.
