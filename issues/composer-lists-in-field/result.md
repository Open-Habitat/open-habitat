# Tulos: listat kirjoituskentän sisällä (kokeellinen)

Kokeellinen ominaisuus `composer-lists-in-field` (Asetukset › Kokeelliset
ominaisuudet › Listat kirjoituskentän sisällä). Kun se on päällä, Tiedosto,
Komennot, kirjoitettu `@` ja `/` sekä Ctrl/⌘+P avaavat listan kentän sisään
tekstin ja nappirivin väliin kierrosten 3 ja 4 mukaan (Puu ja Lista). Pois
päältä kaikki on kuten ennen, myös Ctrl/⌘+P-valitsin.

- **Puu**: koko työtila sisennettynä puuna. Kansio, jonka alla on muutoksia,
  on valmiiksi auki, ja kansiorivin luku kertoo muutettujen määrän. Muutettu
  tiedosto näkyy paikallaan Git-merkillä ja vahvennettuna. Painallus tai →/←
  avaa ja sulkee kansion paikallaan, ← siirtyy ylempään kansioon. Valinta
  alkaa ensimmäisestä muutetusta tiedostosta.
- **Lista**: haku litistää puun, nimi ensin ja kansio perässä (juurena
  työtilan nimi); järjestys tulee daemonilta: koko nimi, nimen osa, nimen
  kirjaimet, pelkkä polku, ja saman tason sisällä muutetut ensin ja sitten
  matalimmat. → näyttää tiedoston kansiossaan: haku tyhjenee, puu aukeaa sen
  kansioon ja sama tiedosto on valittuna.
- **Usean valinta**: ruutu joka rivillä ja napin listassa Tab. *N valittu ·
  Tyhjennä · Lisää N polkua* -rivi lisää merkityt (`@a @b `, kansio muodossa
  `@kansio/`, `!`-komennossa pelkkä polku).
- **Esikatselu** listan vieressä työpöydällä: muutetusta diff ja tila sanoin,
  muusta tiedostosta alku, kansiosta sen sisältö, komennosta kuvaus.
  Puhelimessa (≤ 760 px) esikatselua ei ole.
- **Komennot** ryhmissä Taidot, Pohjat ja Laajennukset ilman hakua. Ctrl/⌘+P
  vaihtaa napin listassa tiedostojen ja komentojen välillä. Esc palauttaa
  tekstiin samaan kohtaan, ja painallus tekstiin tai komposerin ulkopuolelle
  sulkee napin listan. Avoimen listan aikana teksti näyttää kursorin kaksi
  riviä.

## Host

Daemon lukee henkilön omana käyttäjänä samat tiedostonimet kuin `@`-haku
(Gitin näkymä tai rajattu läpikäynti):

- `GET /api/v1/workspaces/file_tree?workspace_id=[&folder=a/b/]`: ilman
  kansiota juuri ja jokainen kansio, jonka alla on muutoksia (puu sellaisena
  kuin se aukeaa), kansion kanssa ensin se ja sitten sen yläkansiot. Kansion suorat lapset,
  alikansioiden muutosmäärät ja tiedostojen Git-merkit. Rajat 32 kansiota,
  500 riviä kansiossa ja 4000 yhteensä; rajattu kansio pitää alikansiot ja
  muutetut. Toimii myös yli 200 tiedoston työtilassa.
- `GET /api/v1/workspaces/files?…&query=…&rank=name`: Listan järjestys
  daemonissa ennen 200:n rajaa; vastauksessa `matched` (osumia ennen rajaa).
- Esikatselu on nykyinen `file_preview`.

Gateway välittää vain nämä tarkat muodot. Ei uutta tallennusta eikä
välimuistia.

## Päätöksiä myöhempään katselmointiin

- **Listan järjestys pyynnön valintana (`rank=name`)**, ei nykyisen haun
  muutoksena. Vaihtoehto oli vaihtaa `matchComposerFiles` kaikille
  (prototyypin host-tieto). Valitsin parametrin, jotta kokeilu ei muuta pois
  päältä olevan listan järjestystä; kun ominaisuus vakiintuu, vanha järjestys
  ja parametri voi poistaa.
- **Oma reitti `file_tree`**, jonka kansiopyyntö tuo myös yläkansiot
  (yksi pyyntö riittää → näytä kansiossa -siirtoon). Vaihtoehto oli
  laajentaa `files`-vastausta tilalla; erillinen muoto on selkeämpi
  validoida.
- **Järjestys kiinteästi *Muutetut ensin*** (Jarin kierroksen 4 valinta),
  ilman valitsinta. Saman tason, muutoksen ja syvyyden jälkeen ratkaisee
  polku, ei sumea pisteytys, kuten prototyypissä.
- **Kansion merkintä lisää `@kansio/`** (kierroksen 2 sääntö). Pi lukee
  kansion itse.
- **Kansion esikatselu** näyttää sisällön puun omasta luvusta (luetaan
  valinnan pysähtyessä), ei uutta daemonin lukua.
- **Kirjoitettu `/` keskellä riviä** (maininta) ei ryhmity lähteittäin, koska
  sen otsikko kertoo jo, että komento mainitaan tekstinä.
- **Tavallisen hakemiston tyhjät kansiot** eivät näy, koska kansiot johdetaan
  tiedostoista samoin kuin Gitin näkymässä.
- **Kansion auki/kiinni ja merkintä** kerrotaan ruudunlukijalle piilotettuna
  tekstinä, koska `option`-rooli ei tue `aria-expanded`- tai
  `aria-checked`-määritettä.

## Katselmointi

Riippumaton `/llm-review` (etsijä gpt-6-astra, todentaja claude-fable-5-1)
ja `/assess-findings`: viisi havaintoa, kaikki vahvistettuja. Korjattu:
pyydetty kansio listataan ensin, jotta rajat eivät jätä sitä pois, ja
selain merkitsee kansion epäonnistuneeksi, jos vastauksesta puuttuu se;
valinta pysyy rivissä eikä indeksissä, kun kansion luku lisää rivejä sen
yläpuolelle; kirjoitetun `@`-listan merkinnät säilyvät kirjoitettaessa
lisää; daemon jättää pois nimet, joissa on rivinvaihto tai muu
ohjausmerkki (sopimuksen kuvio ei hyväksy niitä, ja yksi sellainen nimi
olisi kaatanut koko vastauksen). Hylätty (harvinainen): vastaus voi
teoriassa ylittää selaimen 2 MiB:n lukurajan, jos 4000 riviä ovat
keskimäärin yli 480 tavun polkuja.

## Todisteet

`evidence/`: puu, haku ja kahden merkintä 1440 px vaaleana ja tummana sekä
kahden merkintä puhelimessa (390 px), kustakin vaalean kuvan rinnalla
staattinen HTML. Synteettinen labra (aurinkokello, oikea gateway ja daemon,
Git), ei live-hostia. Kuvat: `OH_COMPOSER_LISTS_CAPTURE=<hakemisto>`
`web/tests/lab-composer-lists-in-field.spec.ts`.

Ajetut tarkistukset: `test-focused.sh --area web` (1289 testiä),
`--area contracts`, `--area go` (`internal/daemon`, `internal/gateway`),
`go test ./test/browser-host`, selainspeksit
`lab-composer-lists-in-field`, `lab-composer-area`, `composer-english` ja
`settings-experimental` (`OH_PORT_BASE=13600`).
