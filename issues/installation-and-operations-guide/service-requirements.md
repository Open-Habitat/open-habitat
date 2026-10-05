# Palveluiden rajoitukset ja diagnostiikka

Gateway käyttää kiinteää ei-root-UID:tä ilman käyttäjien kotihakemistojen
pääsyä tai heidän lisäryhmiään. Palvelun vaatimukset ovat `NoNewPrivileges`,
tyhjä capability-joukko, `ProtectSystem=strict`, `ProtectHome=yes`, yksityiset
device- ja temp-näkymät, rajatut address family- ja namespace-oikeudet,
kernel-suojaukset sekä `UMask=0077`. Sallitut resurssit ovat julkaisun staattiset
tiedostot, rootin hallitsema ei-salainen konfiguraatio, systemd-credentialit,
palvelun runtime-hakemisto, määritellyt socketit ja todennuksen tarvitsemat
HTTPS/DNS-yhteydet.

Daemon-palvelu käyttää `User=%i`, `Group=%i`, `NoNewPrivileges`, ei capability-
tai setuid-korotusta, `KillMode=mixed`, `Restart=on-failure`,
`ProtectSystem=full` ja `ProtectHome=no`. Sen `HOME`, `USER`, `LOGNAME`,
`XDG_RUNTIME_DIR` ja PATH asetetaan natiiveille työkaluille. Valinnainen
käyttäjän 0600-environment-tiedosto saa sisältää vakaita ympäristöarvoja;
shell-aloitustiedostoja ei suoriteta. Vain määritellyt socket-instanssit aktivoidaan.

Daemonin hallittu sammutus estää uudet kirjoitukset, pyytää omistamiaan Pi-lapsia
keskeyttämään ja asettumaan, signaloi suoraa prosessiryhmää ja odottaa rajatun
ajan. Systemd huolehtii palveluun jääneistä prosesseista. Palvelusta irronneen
työkalun päättymistä ei väitetä ilman natiivia näyttöä.

[Palvelumallit](../../systemd/) ovat toteutuksen lähtökohta. Kaikki yllä luetellut
suojaukset eivät vielä näy nykyisissä malleissa. Niiden puuttuminen ei kumoa
vaatimusta eikä kerro yksin todellisen asennuksen tilaa;
[asennus- ja palautumistyö](item.md) todentaa
mallit ja asennuksen erikseen.

`/healthz` ja `/readyz` palauttavat vain aggregoidun tilan. Tarkka readiness on
rajatun mode-0660 admin-UDS:n takana. Lokit eivät sisällä cookieita,
OAuth-koodeja tai tokeneita, CSRF-arvoja, prompteja, mallivastauksia,
tool-payloadia, tiedostosisältöä, täyttä argv:tä tai natiivien credentialien
metadataa. Nämä ovat nykyinen tietosuojaraja;
[logging.md](../../docs/logging.md) on erillinen ehdotus.

Staattisen frontendin `index.html`-fallback koskee vain tunnettuja UI-reittejä,
ei API-, event-, auth- tai health-polkuja. CLI:n vaadittu komentopinta ja
tulostussopimus kuvataan [CONFORMANCE.md:ssä](../../CONFORMANCE.md#operator-contract).

