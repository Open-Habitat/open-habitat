# Avoimen keskustelun korostus Hiljaisissa: opas (kierros 5)

Avaa `hiljaiset-r5.html`. Se on yksi offline-sivu. Ulkoasu on kierroksen 4
**Ruudut**, ja tällä kierroksella vaihtelee vain se, miten avoimen
keskustelun rivi erottuu listassa ja taitettuna (ja taitettuna sen
työtilan pilleri). Avoinna on *Verbien taivutus* (deutschpad).

Suunnat, yksi rivi kustakin (sama luettelo on sivun yläosassa):

- **1 · Viiva**: kierroksen 4 aksenttiviiva, eli valkoinen rivi ja vasemmassa reunassa turkoosi viiva. Taitettuna pillerillä on turkoosi reuna.
- **2 · Rengas**: turkoosi rengas koko rivin ympäri, ei viivaa. Taitettuna pillerillä on sama rengas.
- **3 · Työtilan väri**: viiva kuten suunnassa 1, mutta työtilan kuvakkeen värinen (deutschpadilla luumunpunainen). Taitettuna pilleri saa saman värin.
- **4 · Täyttö**: ei viivaa eikä rengasta. Koko rivi on vaalean turkoosin sävyinen ja teksti turkoosi, ja taitettuna pilleri on täytetty samoin.
- **5 · Kieleke**: rivi jatkuu raiteen reunaan asti keskustelun taustavärissä, kuin välilehti, josta avoin keskustelu riippuu. Puhelimessa raide on laatikko, joten siellä rivi on reunaviivainen. Taitettuna pilleri on samaa taustaa.

Kaikissa:

- Ikkunasta on poistettu teksti *Näkyy heti listassa. Seuraa sinua
  kaikille laitteille.* Jäljellä on vain Valmis.
- Järjestys säilyy, kun rajaat yhteen työtilaan ja palaat Kaikkiin, kuten
  kierroksessa 4.

## Mistä katsoa

**Rinnakkain**-osio näyttää kaikki viisi suuntaa vierekkäin ilman
klikkausta. Rivejä on neljä: työpöytä vaaleana, työpöytä tummana, puhelin
vaaleana ja puhelin tummana. Jokaisessa ruudussa on Hiljaisten kuusi
ensimmäistä riviä ja taitettu osio. Neljäs muu rivi on hiiren alla, jotta
korostusta voi verrata hover-tilaan. Ruudun oikeassa reunassa on kaistale
keskustelun taustaa, jotta raiteen reuna näkyy (tärkeä suunnalle 5).
Puhelinruudut ovat oikeaa laatikkoa kapeampia, joten pillerit rivittyvät
niissä kahdelle riville. Koko puhelinnäkymässä ne mahtuvat yhdelle.

Alempana on **Koko näkymässä** valitulle suunnalle (valitsin ylhäällä,
näppäimet 1–5 tai ←/→). Siellä voit vaihtaa teeman, laitteen ja määrän ja
klikata rivejä: korostus siirtyy avatulle riville.

## Kokeile näin

1. Katso Rinnakkain-osio ylhäältä alas: erottuuko avoin rivi hover-rivistä
   ja muista riveistä yhtä hyvin vaaleana ja tummana?
2. Katso taitetut osiot: kuuluuko pillerin merkintä samaan perheeseen kuin
   rivin korostus?
3. Valitse 5 · Kieleke ja katso koko näkymää: välilehti osuu raiteen ja
   keskustelun rajalle.
4. Avaa ikkuna otsikon oikeasta päästä: alateksti on poissa.

Suosittelen suuntaa **1 · Viiva**. Perustelut ja kysymykset ovat issuen
`result.md`:ssä. Kuvat ovat hakemistossa `kuvat/` laitteen skaalauksella 2.

Sivu rakennetaan komennolla `python3 build.py` tiedostosta `page.src.html`.
Kuvat otetaan komennolla `node shots.mjs <polku>/hiljaiset-r5.html
<hakemisto>`. Sama ajo klikkaa säätimet jokaisessa suunnassa (työpöytä,
puhelin, tumma Paljon-näkymä). Kuvat muunnetaan AVIF-muotoon komennolla
`scripts/screenshots-to-avif.py`.
