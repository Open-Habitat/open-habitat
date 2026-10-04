# Navigaation ja asetusten suunnittelupaketti

Ensimmäinen inventaariopohjainen paketti on koottu ja toimitettu Jarille.
Navigaation ja asetusten yhteisen kierroksen pyyntö on [REQUEST.md](REQUEST.md).
Designerin vastausta ei ole vielä saatu.

## Toimitettu aineisto

Paketin lähdecommit on `176d9e643440530cee375a5dc6249b95ab3f95db`.
Koko inventaario esitettiin uutena: 21 tilaa neljässä esitystavassa tuotti
84 onnistunutta kaappausta. Lisäksi 18 aukkotilalta puuttui yhteensä
72 esitystä. `rendered-pages/COVERAGE.md` kuvaa puuttuvan aineiston sekä
vastaavuusaukot toteutuksen ja vedosten välillä. Mukana olevat vanhemmat
Pi-lohkojen ja kontrollimigraation erillistallenteet täydentävät aineistoa.

Aineisto on synteettistä. Pakettikopioista poistettiin omistajan nimi,
kotihakemistopolku ja synteettinen laitekoodiesimerkki; `MANIFEST.md`
kirjaa nämä muutokset lähdetiedostoihin nähden.

[Issuen toimitusmerkinnän](../item.md#comments) mukaan paketti toimitettiin
4.10.2026 maplein tiedostoon `~/Downloads/align-navigation-design.zip`.
Tiedoston koko oli 14 978 055 tavua ja koneella tarkistettu SHA-256:

```text
de2edcee82dc1386bfa9b0a1e590a69c8b1495218b21f7293cf5655ede442221
```

## Pyynnön nykyinen rajaus

Jarin kanssa 4.10.2026 tarkennettu pyyntö keskittyy navigaatioon ja asetuksiin.
Kontrollien yhteinen tilasuunnittelu kuuluu
[design-control-states](../../design-control-states/item.md)-issueen ja
Pi-lohkojen suunnittelu aineistoviitteineen
[design-pi-event-blocks](../../design-pi-event-blocks/item.md)-issueen.

Yllä tunnistettu zip sisältää alkuperäisen, laajemman pyynnön. Repossa oleva
REQUEST.md on tarkennettu sen toimituksen jälkeen; zipiä ei ole tässä
tekstikierroksessa päivitetty. Seuraavassa toimituksessa käytetään tarkennettua
pyyntöä ja kirjataan uuden paketin lähdecommit ja toimitustiedot.
