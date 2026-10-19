// Tiedostot (proto-file-viewing, 19.10.2026). Keskustelun tiedostoviittaukset ovat linkkejä,
// ja koko työtilan voi selata ja muokata. Tunnistus on sama kaikissa suunnissa: polku
// (`web/src/components/QuotaMeter.tsx:34`), `@`-viittaus, absoluuttinen polku työtilan sisällä,
// diffin `a/`- ja `b/`-polut ja `go test`in paketin suhteelliset nimet tulevat linkeiksi vain,
// jos tiedosto on työtilassa; muut jäävät tekstiksi. Sisältö on sama; suunnat eroavat siinä,
// missä tiedosto avautuu suhteessa keskusteluun.
export const title = 'Tiedostot ja tiedostolinkit';
export const app = true;
export const variants = [
  { name: 'Rinnalla', axis: 'tiedosto avautuu keskustelun viereen omaan paneeliinsa (puhelimessa koko näkymäksi); oma kevyt katselin ja muokkain, puu samassa paneelissa', fn: 'v1' },
  { name: 'Editori', axis: 'tiedosto avautuu työtilan VS Codeen (code-server henkilön omana käyttäjänä omassa originissaan), joka on keskustelun vaihtoehtoinen näkymä yläpalkin valitsimen takana', fn: 'v2' },
  { name: 'Kurkistus', axis: 'tiedosto avautuu keskustelun sisään linkin alle muutaman rivin ikkunana; koko tiedosto ja puu ovat erillinen Tiedostot-sivu keskustelun tilalla', fn: 'v3' },
];
