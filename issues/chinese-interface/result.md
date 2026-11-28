# Kiinankielinen käyttöliittymä: prototyyppi ja koodisuunnitelma

## Kierros 1

Kierros: `design-system/prototypes/rounds/2026-11-28-kiina-1/` (`NOTES.md`
kertoo URL-parametrit ja komennot). Sivu:
`design-system/prototypes/dist/2026-11-28-kiina-1/offline.html`, tehdään
uudelleen komennolla
`node design-system/prototypes/rounds/2026-11-28-kiina-1/build.mjs`.
Koodisuunnitelma on [design.md](design.md).

Tuotannon näkymät yksinkertaistetulla kiinalla, oikean pituisin teksteinä:
sivupalkki, keskustelu kenttineen, tilivalikko, Asetukset › Ulkoasu ja Tili,
käyttöönoton repojen valinta ja uloskirjautumisen ikkuna, työpöydällä (1440)
ja puhelimessa (390), päivä- ja yöteemassa. Kieli-valitsimella saman näkymän
näkee suomeksi ja englanniksi pituuden vertailuun. Komponentit ovat
tuotannon, muuttamattomia; kiina tulee tuotannon luetteloihin liitetystä
`zh-CN`-kohdasta samalla tavalla kuin suunnitelman `locale()`.

**Akseli: mistä kiinan merkit tulevat.**

- **A · Nyt**: tuotannon pino sellaisenaan. Merkit tulevat siitä, mitä
  selain sattuu valitsemaan. Tarkistuskoneella se on WenQuanYi Zen Hei
  yhdellä painolla, joten lihavoinnit ovat keinotekoisia, kursiivi on
  vino Han-merkki ja isojen kirjainten harvennus levittää otsikot
  (*从 浏 览 器 中 移 除* uloskirjautumisen ikkunassa).
- **B · Pino** (suositus): kieli saa nimetyn CJK-pinon (PingFang,
  Microsoft YaHei, Noto Sans CJK) ja kiinan säännöt: rivikorkeus 1,75/1,6,
  pienin koko 12 px, ei kursiivia vaan paino, ei harvennusta, väli kiinan ja
  latinan välissä, tiukka rivitys. Ei latausta. Kiinankieliset koneet tuovat
  hyvän fontin mukanaan; pino vain valitsee sen.
- **C · Fontti**: B:n säännöt ja oma Noto Sans SC paloina. Sama ilme
  kaikkialla ja oikeat painot; hinta noin 3,7 Mt painoa kohden, näiden
  näkymien 54 palaa olivat 1,6 Mt kolmella painolla.

**Kielivalinta** (Asetukset › Ulkoasu): kuusi vaihtoehtoa omilla nimillään
(*Järjestelmä, Suomi, English (US), English (UK), 简体中文, 繁體中文*), ja
molemmissa kiinoissa käyttöliittymän kielellä merkintä Beta: tekoälyn
luonnos, natiivitarkastus kesken. Valinta vaihtaa kielen heti.

### Missä design rikkoutuu

- **Agentin vuoron kesto** on kovakoodattu: *2 个工具 · 4 min 00 s*
  (`AgentTurn.tsx:204`). Sama koskee muutamaa `=== "fi"`-haaraa ja asetusten
  nimiä, jotka valitsevat suomen tai englannin.
- **Lauseen palaset**: komponentti lisää välin selitteen ja arvon väliin,
  ja kiinan leveä kaksoispiste tuo oman välinsä (*最后更新： 2026/11/27*,
  *服务器版本： 未收到*).
- **Erotin `·`** on kiinan yhteydessä rivinvaihtokohta: vedoksen omat
  valitsinnimet rivittyivät, kunnes ne merkittiin suomeksi. Tuotannossa
  samaa erotinta on lyhyissä yhdistelmissä.
- **Harvennus ja kursiivi** (A): katso yllä. B ja C korjaavat ne.
- Pituus ei ole ongelma: kiina on lyhyempää kuin suomi ja englanti, ja
  pitkä otsikko katkeaa sivupalkissa siististi kolmeen pisteeseen.
- Väliä (adjacency) ei syntynyt kiinasta yhtään uutta; tuotannon omat
  läheisyydet näkyvät myös suomeksi ja englanniksi (`check.mjs` raportoi
  ne).

### Mitä vedos olettaa

Ei host-tietoja: henkilö, repot, keskustelut ja aika (Shanghai) ovat
synteettisiä, `/api` vastaa 404. zh-TW-valinta vaihtaa kielen ja pinon,
mutta tekstit ovat zh-CN:n. Käännökset ovat agentin luonnoksia vain näiden
näkymien noin 240 avaimelle (koko tuotteessa 8 206 viestiä).

### Päätettäväksi myöhemmin

- Fontti: B (nimetty pino), C vasta jos testaajat näkevät rikkinäisiä
  lihavointeja.
- Kielirivi: kielet omilla nimillään, Beta-merkintä käyttöliittymän kielellä.
- Suunnitelman vaiheet 0 ja 1 (korjaukset ja luetteloiden avaus) ennen
  kiinaa, koska ne tarvitaan mihin tahansa lisäkieleen.

### Kysymykset Jarille

1. Riittääkö B (järjestelmän fontti), vai haluatko saman ilmeen kaikkialla
   ja 1–2 Mt latauksen kiinankieliselle sivulle (C)?
2. Agentti kiinaksi: 智能体 (Manner-Kiinan tekoälykielessä vakiintunut) vai
   代理 (yleisempi sana, myös Taiwanissa)? Vedos käyttää 智能体:tä zh-CN:ssä.
3. Saako vaihe 1 lisätä kehitykseen pseudokielen (`en-XA`, 40 % pidempi,
   aksentoitu), joka paljastaa kovakoodatut tekstit ennen kuin yksikään
   oikea kieli tulee?
