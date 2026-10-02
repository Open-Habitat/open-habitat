# Päätökset ja avoimet valinnat

Järjestelmä tuo käyttäjän natiivit työtilat ja agentit selaimeen. Unix-käyttäjät
rajaavat pääsyn, ja natiivit työkalut omistavat edelleen tiedostonsa,
tunnuksensa ja historiansa. Alla ovat sovitut ratkaisut ja niiden perustelut.
Toteutuksen eteneminen on [tilannesivulla](status.md).

## Hyväksytyt ratkaisut

| Valinta | Mitä on sovittu | Perustelut |
|---|---|---|
| Natiivi perusta | Gateway ohjaa kirjautuneen käyttäjän tämän omalle Unix-daemonille. Työtilat ja historiat luetaan natiiveista lähteistä; selaimelle tarjotaan HTTP/SSE-rajapinta. | [ADR 0001](adr-0001-unix-native-agent-host.md) |
| Selainasiakas | React ja TypeScript, yksi Redux-tapahtumatila, React Aria sekä turvallinen Markdownin, koodin ja diffien esitys. Tuotantokomponentit ja Storybook käyttävät samaa koodia. | [ADR 0002](adr-0002-frontend-stack.md) |
| Host ja kirjautuminen | Yksi Go-binaari, erilliset gatewayn, daemonin ja brokerin vastuut, systemd ja Unix-socketit. GitHub-kirjautuminen asentaa myös käyttäjän natiivit `gh`-tunnukset. Tuote omistaa yleisen paketoinnin, Fleetrepo konkreettisen asennuksen. | [ADR 0003](adr-0003-host-stack.md) |
| Ensimmäinen kirjautuminen | Root-broker luo sallitulle GitHub-käyttäjälle Unix-tilin. Pysyvä sidos perustuu varmennettuun numeeriseen GitHub-ID:hen. | [ADR 0004](adr-0004-first-login-user-provisioning.md) |
| Kloonauksen eteneminen | Daemon välittää Gitin etenemisen selaimeen. Yhteyskatko keskeyttää kirjoituksen; paluu selvittää tuloksen natiivista Gitistä. Levyraja tulee 2026-10-01 päätöksen mukaan käyttäjäkohtaisesta ylläpitäjän rajaamasta `~/src`-liitoksesta, ei kloonikohtaisesta broker-kiintiöstä. Erillistä edistymistietovarastoa tai automaattista uusintaa ei lisätä. | [ADR 0005](adr-0005-clone-progress-stream.md) |
| Selainistuntojen mitätöinti | Root voi mitätöidä yhden GitHub-käyttäjän selainistunnot ja aiemmin alkaneet OAuth-virrat paikallisesti. Toimi ei poista Unix-tiliä eikä natiiveja tunnuksia. | [ADR 0006](adr-0006-subject-revocation.md) |

[Käyttökulut](ui.md) kuvaavat sovitun keskustelu- ja työtilakokemuksen;
[rajapinnat](interfaces.md) tietojen omistajuuden ja yhteyksien käyttäytymisen.
Alkuperäiset hyväksynnät ovat [UI-päätöksessä 22.9.](../issues/review-ui-v1/review.md)
ja [toteutuspaketin päätöksessä 23.9.](../issues/review-implementation-plan/review.md).
Myöhemmät rajaukset löytyvät nykyisistä sivuista ja ADR:istä.

## Avoimet valinnat

- **Nopea keskustelun vaihto.** [ADR 0008](adr-0008-snappy-conversation-switching.md)
  ehdottaa viimeksi katsottujen keskustelujen rajattua selainmuistinäkymää ja
  yhtä käyttäjäkohtaista tapahtumayhteyttä välilehteä kohti. Natiivihistoria
  pysyy ainoana totuutena; Jari ei ole vielä hyväksynyt ehdotusta.
- **Sidotun Unix-käyttäjän poistaminen.** [ADR 0007](adr-0007-bound-user-deprovision.md)
  jää myöhemmäksi: käyttäjän ”poista minut” -toiminto ja ylläpitäjän CLI-komento
  ovat tulevia tarpeita, joiden toteutustapaa ei ole päätetty. Nykyiseen
  testikäyttöön riittää koko testiympäristön nollaus (Jarin päätös 30.9.2026).
- **Lokituksen tarkempi käytäntö.** [Lokitusehdotus](logging.md) jättää
  päätettäväksi komponenttien välisen tapahtumien yhdistämisen, säilytys- ja
  käyttöoikeusrajat sekä käyttäjälle mahdollisesti annettavan tukiviitteen.
  Tunnusten ja käyttäjän sisällön suojaaminen kuuluu jo hyväksyttyyn rakenteeseen.

Muut agenttiohjelmat, sovelluskohtaiset integraatiot, vahvempi eristys ja usean
palvelimen selainkäyttö tarvitsevat oman päätöksensä, jos niille tulee tarve.
