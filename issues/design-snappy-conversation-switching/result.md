# Tuore keskustelu auki ilman odotusta

Jari hyväksyi 2.10.2026 rethink-läpikäynnissä
[ADR 0008:n](../../docs/adr-0008-snappy-conversation-switching.md) suunnan:
selain pitää avattujen keskustelujen tuoretta sisältöä rajatusti muistissa,
ja yksi tapahtumayhteys välilehteä kohti päivittää myös taustalla olevia
keskusteluja. Muistissa olevaan keskusteluun paluu ei odota verkkoa.
Sivun uudelleenlataus, muistista poistunut keskustelu ja kauas historiaan
selaaminen voivat vaatia latauksen. Pi omistaa historian ja daemon ratkaisee
komentojen hyväksymisen.

Muistille asetetaan väljät, muutettavat rajat, jotta äskettäin katsottu sisältö
pysyy käytettävissä. Keskustelunvaihdosta tehdään merkittävästi nopeampi.
Selaimeen ei lisätä pysyvää historiavarastoa.

@browser-logout-cleanup vastaa streamien kuuntelun lopettamisesta ja käyttäjän
selainmuistin tyhjentämisestä uloskirjautumisessa. Keskustelunvaihdon toteutus
antaa yhteyden ja muistin siivouksen tämän yhteisen toiminnon käytettäväksi.

Jari kyseenalaisti erillisen istuntojen peruuttamisen laajennuksen tarpeen.
@reliable-session-revocation suljettiin nykyisessä laajuudessa tarpeettomana;
nykyinen broker-tarkistus ja jo hyväksyttyjen yhteyksien käytös säilyvät.

## Näyttö ja sen rajat

Synteettisessä labrassa neljä vaihtoa kahden vain luettavan keskustelun välillä
vei 108, 117, 100 ja 116 ms: jokainen teki historiapyynnön. Ohjattavan
keskustelun tarkkaa A↔B-vaihtoa ei mitattu. Simulaation tavallinen yksi agentti
tuottaa noin 2,6 KiB/s ja raskas kahdeksan agentin tapaus noin 117 KiB/s
välilehteä kohti. CPU- ja muistilaajennuskertoimet ovat oletuksia.

[Mittaukset](measurements.md) kertovat lähtörevision ja rajaukset.
[Simulaatio](simulate.py) ja [tuloste](simulation-output.txt) kuvaavat
resurssiarvioiden oletukset ja tulokset.

## Jäljellä oleva toteutus

@one-browser-event-stream vastaa yhteydestä ja palautumisesta,
@tail-first-history-paging uusimmasta päästä luettavasta historiasta ja
@recent-conversation-windows muistissa pidettävistä näkymistä sekä
käyttökokemuksen mittauksista. Tuotteen uutta toimintaa ei toteutettu eikä
mitattu tämän tekstikierroksen aikana.

Dokumentaatiovalidaattori ja `git diff --check` läpäisivät. Issue doctorissa
oli vain muiden issueiden 235 ennestään olevaa kuvamuotohavaintoa.
Täyttä CI-porttia tai vanhoja kokeita ei ajettu uudelleen, koska muutokset
koskevat dokumentteja ja issueita (TESTING.md).
