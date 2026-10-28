# Päätteessä aloitettu keskustelu · kierros 1

Avaa `index.html` selaimessa (toimii ilman verkkoa, fontit on upotettu). Alareunan
valitsimella vaihdat suuntaa (näppäimet 1–3, ←/→). Yläpalkin valinnoista saat teeman ja
puhelinleveyden. **Tilanne**-valinta vaihtaa sitä, missä päätteen Pi on:

- **Pi tmuxissa (SSH)**: aloitit keskustelun SSH:n yli omassa tmux-istunnossasi `work`,
  ikkunassa 2, ja Pi on yhä käynnissä.
- **Pi päätteessä ilman tmuxia**: Pi pyörii tavallisessa SSH-päätteessä (`pts/4`).
- **Pi suljettu**: lopetit Pi:n päätteessä, ja keskustelu on levossa.

**Sulje Pi SSH-päätteessä** -painike esittää sitä, että lopetat Pi:n siellä kesken kaiken.
Katso silloin, miten näkymä ja avoin päätevälilehti seuraavat.

## Mistä on kyse

Kun aloitat Pi-keskustelun päätteessä, selain näyttää sen nyt vain luettavana. Alareunassa
lukee "Jatkaminen estetty: keskustelulla on aktiivinen kirjoittaja", eikä mikään kerro,
missä Pi pyörii tai miten pääset jatkamaan. Selain ei myöskään voi ottaa päätteessä
aloitettua keskustelua ohjattavakseen sen jälkeen, kun Pi on suljettu. Tämä on tietoinen
sääntö: vain selaimen aloittama keskustelu on selaimen ohjattavissa.

Kaikissa suunnissa on sama keskustelu, sama yläpalkki (Käynnissä päätteessä · Vain luku)
ja sama sivupalkin merkki. Suunnat eroavat siinä, **kuinka pitkälle selain menee**:

| Suunta | Pi käynnissä tmuxissa | Pi suljettu | Milloin oikea | Hinta |
| --- | --- | --- | --- | --- |
| **Kerro** | Kertoo istunnon ja ikkunan (`work`, ikkuna 2) ja antaa kopioitavan komennon `tmux attach -t work:2` | Antaa kopioitavan komennon `cd ~/src/aurinkokello && pi --session 019a3c7e` ja Avaa pääte -painikkeen | Haluat vain tietää, missä keskustelu on, ja jatkat omassa päätteessäsi | Puhelimella et pääse jatkamaan ilman SSH-sovellusta |
| **Katso** | Katso päätteessä avaa paneeliin vain luettavan peilin tmux-ikkunasta. Näppäimet eivät mene sinne, ja peili sanoo sen | Avaa päätteessä kirjoittaa jatkokomennon uuteen selaimen päätteeseen. Sinä painat Enteriä | Haluat seurata päätteen Pi:tä puhelimella kesken päivän | Peili näyttää ikkunan koneen leveydellä; kapealla näytöllä rivit katkeavat sivusuunnassa |
| **Jatka** | Jatka päätteessä liittää selaimen samaan tmux-ikkunaan toisena asiakkaana. Kirjoitat Pi:lle paneelissa, ja SSH-pääte näkee saman | Jatka päätteessä käynnistää Pi:n uuteen selaimen päätteeseen tällä keskustelulla. Viestit kirjoitetaan siellä, ja historia päivittyy näkymään | Haluat jatkaa samaa keskustelua mistä tahansa, myös puhelimesta | tmux sovittaa ikkunan viimeksi käytetyn asiakkaan kokoon: puhelimella kirjoittaminen kaventaa ikkunan myös SSH-päätteessä |

Kun Pi on päätteessä ilman tmuxia, selain ei näe eikä tavoita sitä. Kerro sanoo vain,
missä se on. Katso- ja Jatka-suunnissa painike on harmaa ja kertoo syyn. Jatkassa lisäksi
lukee, että voit sulkea Pi:n päätteessä ja jatkaa sitten täällä.

## Mitä kannattaa kokeilla

1. **Katso**: avaa peili ja yritä kirjoittaa siihen. Riittääkö "Näppäimet eivät mene peiliin",
   vai pitäisikö peilin näyttää vielä selvemmin, ettei se ole oma päätteesi?
2. **Jatka**: kirjoita paneelissa Pi:lle ja paina Enter. Viesti näkyy hetken päästä
   keskustelussa yläpuolella. Tuntuuko se samalta keskustelulta vai kahdelta näkymältä?
3. Paina missä tahansa suunnassa **Sulje Pi SSH-päätteessä**. Alapalkki muuttuu
   jatkamiseksi, ja avoin tmux-välilehti palaa kehotteeseen.
4. Vaihda puhelinleveyteen. Paneeli vie koko sarakkeen, ja Keskustelu-painike palauttaa
   keskustelun.

## Kysymyksiä Jarille

- Käytätkö tmuxia Birchn SSH-yhteyksillä? Jos et, Katso ja Jatka toimisivat sinulla vain
  suljetun keskustelun jatkamisessa.
- Riittääkö puhelimella se, että näet päätteen Pi:n (Katso), vai haluatko kirjoittaa sille
  (Jatka), vaikka SSH-päätteen ikkuna kapenee samalla?
- Jos Pi on suljettu, pitäisikö selaimen käynnistää se heti (Jatka) vai kirjoittaa komento
  valmiiksi ja odottaa Enteriä (Katso)?

Tarkemmat host-tiedot, suositus ja tekemäni ratkaisut ovat issuen `result.md`:ssä.
Keskustelu, tmux-nimet, PID:t ja kellonajat ovat keksittyjä.
