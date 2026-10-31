# Tulos

Tutkimus on [report.md](report.md): suositus on sijoittaa nykyinen
järjestelmädaemon ihmisen `user-UID.slice`:en ja käyttää siinä yhteistä
rootin hallitsemaa budjettia. Tämä on suositus ADR:ää varten, ei hyväksytty
arkkitehtuuripäätös tai toteutus.

Varmennettu Birchlla vain lukemalla nykyiset cgroupit sekä lyhyillä,
aikarajatuilla ja poistuneilla transienttiyksiköillä: user-servicen kernelin
muisti-/tehtävä-/CPU-rajat, lapsen jäsenyys, user-scope sekä saman UID:n
järjestelmäpalvelun sijoitus user-sliceen. Lähteet ja tulokset raportissa.
OOM-kuormaa, uudelleenkäynnistyksiä, uusia SSH-istuntoja tai Pi:n säilymistä
päivityksen yli ei testattu. Tuotekoodi, palvelimen pysyvä konfiguraatio ja
Fleetrepo jäivät muuttamatta. Tutkimuksen valmistuminen ei sulje erillistä
`daemon-pi-outside-user-slice`-toteutusongelmaa.
