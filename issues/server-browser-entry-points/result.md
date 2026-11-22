# Palvelinselaimen avauspaikat

## Saatesanat

Molemmille on käyttöä, jos ne eivät lupaa samaa asiaa. Sivupalkista pääset
omaan selaimeesi riippumatta siitä, mitä keskustelua luet. Kentän luona taas
kiinnostavat tämän agenttityön ikkunat ja juuri nyt sinua tarvitseva ikkuna.

Suosittelen **suuntaa 3, Molemmat**. Siinä sivupalkin **Oma selain** avaa kaikki
kolme omaa ikkunaa ja **Tämän keskustelun ikkunat · 2** rajaa näkymän tähän
työhön. Vaihda sivupalkista toiseen keskusteluun: siru katoaa, mutta selaimeen
pääsee yhä. Katselu ei vie ohjausta agentilta.

Tärkeä ero nykytilaan: host ei vielä kerro, mihin keskusteluun ikkuna kuuluu.
Vedos näyttää halutun eron, ei jo olemassa olevaa rajausta. Tätä ei pidä
ratkaista nimeämällä nykyinen yhteinen ikkunalista keskustelukohtaiseksi.

## Suunnat

| Suunta | Päätös | Hinta |
| --- | --- | --- |
| 1 Siru | Pääovi kentän luona; huomiorivi sivupalkissa vain pyynnön aikana | Selaimen löytäminen ilman siihen liittyvää keskustelua on epäsuorempaa. Sirun kautta voi silti avata kaikki ikkunat. |
| 2 Rivi | Yksi avauspaikka sivupalkissa; keskustelussa vain selaintyön tekstirivi | Selkeä omistus, mutta pyynnön hoitaminen vaatii siirtymisen sivupalkkiin, puhelimessa sen avaamisen ensin. |
| 3 Molemmat | Koko oma selain ja tämän keskustelun ikkunat ovat eri rajaukset | Kaksi ovea on perusteltava oikealla keskustelutiedolla, ei vain eri nimillä. |

Oletusnäkymässä on sama agentin työ ja kirjautumisvahvistusta odottava ikkuna.
Yläpalkissa on kustakin suunnasta yksi rivi sekä kieli-, teema- ja tilannevalinta.
Kaikissa suunnissa voi katsoa ikkunaa, ottaa ohjauksen, simuloida vahvistuksen
ja palauttaa ohjauksen. Sivupalkin toinen keskustelu ja henkilökohtainen kolmas
ikkuna tekevät rajauksen näkyväksi.

## Questions for Jari

1. Valitaanko suunta 3: sivupalkki koko omalle selaimelle, siru vain tämän
   keskustelun ikkunoille?
2. Riittääkö toisessa keskustelussa sivupalkin huomiomerkki (puhelimessa
   sivupalkin avauspainikkeessa), vai pitääkö pyyntö tuoda kentän luo sielläkin?

## Decisions for later review

- **Siru piiloon asiaan liittymättömässä keskustelussa (3).** Vaihtoehto on
  näyttää yhteinen selain kaikkialla kuten nyt. Piilotus tekee sirun rajauksesta
  todellisen ja vähentää toisen keskustelun hälyä.
- **Pyyntö ei kaappaa katselunäkymää tai ohjausta.** Se näkyy kentän yllä ja
  avautuu painalluksesta. Vaihtoehto on automaattisesti avautuva iso näkymä;
  lukemisen ja kirjoittamisen jatkuvuus painaa tässä enemmän.
- **Puhelimessa globaali huomio näkyy sivupalkin avaajassa.** Vaihtoehtona
  erillinen pysyvä selainpainike; sitä ei lisätty kolmanneksi avauspaikaksi.
- **Keskustelun ja ikkunan yhteys on synteettinen oletus.** Tuotannon
  `BrowserWindow.agent` ja `BrowserRequest.window` eivät sisällä keskustelun
  tunnistetta. Mahdollinen hostin raportointi suunnitellaan erikseen valinnan
  jälkeen. Tuntemattomasta yhteydestä ei saa arvata omistajaa.

## Toimitus ja näyttö

Lähteet: `design-system/prototypes/rounds/2026-11-22-server-browser-entry/`.
Rakennus ja tarkistuksen käyttö on kierroksen `NOTES.md`:ssä.

Rakennettu itsenäinen sivu tällä työhostilla:
`/var/tmp/agent-keep/server-browser-entry-points/offline.html`.
Sivu ja kuvat eivät kuulu gitiin. Tarkistuksen kuvat ovat saman hakemiston
`check/`-alihakemistossa. `current-sheet.{png,html}` ja
`current-rail.{png,html}` näyttävät tuotannon nykytilaa synteettisessä labissa;
niitä ei ole kuvattu oikeasta asennuksesta. Lab suljettiin tarkastelun jälkeen.

Lähtöcommit: `763d97b73cd478fb993340d0c78d4f00d86212b5`. Tarkistettu puu on
sitä seuraava tämän kierroksen lähde; muutokset rajoittuvat kierrokseen ja tähän
issueen. Ei tuotantokoodin, sopimuksen, daemonin tai käyttöoikeuksien muutoksia.

## Tarkistus ja rajat

- Offline-build ja kierroksen `check.mjs`: **36 yhdistelmää läpi** (3 suuntaa ×
  fi/en × 1440/390 px × päivä/yö/kontrasti). Rajaukset, pyynnöt, ohjaus,
  palautus, käynnistys, näppäimistösulkeminen, valitsin, vaakaylivuoto ja
  verkkopyyntöjen puuttuminen tarkistettu. Konsoli puhdas.
- Axe: sovellusalue, kaikki kolme suuntaa suomeksi vaaleana 390 px:ssä, ei
  havaintoja. Ei väitettä koko tuotteen saavutettavuudesta.
- Kuvista katsottu suosituksen työpöytänäkymä, rivisuunta tummana englanniksi,
  sirusuunta puhelimessa ja koko selaimen dialogi puhelimessa tummana.
- Nykyinen sivupalkki ja read-only-katselin avattu oikeilla tuotantokomponenteilla
  synteettisessä labissa. Se ei ole oikean palvelimen tai Chrome-palvelun hyväksyntä.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json` ja
  `git diff --check`: läpi; Project View valid (16 pages), doctor ilman havaintoja.
- Katselmointitaso: oma lähde-, toiminta- ja kuvakatselmointi. Riittävä
  eristetylle esityskieliprototyypille; riippumatonta LLM-katselmointia ei
  tarvittu, koska natiivisessioihin, tilanomistukseen tai turvarajoihin ei koskettu.
- Ei koko selainpakettia, Go-testejä, clean gatea eikä live-asennuksen muutosta:
  tämä ei ole tuotantototeutus. Vaadittuja prototyyppitarkistuksia ei jäänyt ajamatta.

Issue jää tilaan `testing` odottamaan Jarin suunnanvalintaa.
