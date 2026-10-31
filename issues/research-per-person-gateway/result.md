# Tulos

Tutkimus on [report.md](report.md)-tiedostossa. Suositus jatkopäätökseen on erillinen vakaa palvelu-UID ja app-origin per ihminen sekä yhteisen tunnistus-/ylläpitovallan erottaminen. Se ei ole arkkitehtuuripäätös tai toteutuslupa.

Varmennettu lähdekoodista: nykyinen daemonin gateway-UID-tarkistus, yhteinen socket-valta, systemd-politiikka ja upstreamien erot. Kahdeksan versioitua upstream-lähdettä haettiin onnistuneesti. Turvalliset paikallishavainnot: oma Unix-socket/SO_PEERCRED-koe, nykyisen gatewayn hetkellinen cgroup-muistiluku ja vieraan proc-polun kielteinen lukutulos. Raportti erottaa nämä uuden arkkitehtuurin mittaamattomasta idle-muistista ja turvatodisteesta.

Ei tuotemuutoksia, palvelurestartteja, käyttöönottoa, uusia issueita tai arkkitehtuuriprototyyppiä. Fleetrepon toteutusta ei auditoitu. Tuotetestejä ei ajettu; dokumenttimuutosten whitespace tarkistettiin `git diff --check`illä. Jatkotoimi on Jarille raportin ADR-kysymysten ratkaiseminen, ei automaattinen toteutus.
