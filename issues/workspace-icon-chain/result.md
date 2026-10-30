# Tulos: työtilan kuvake repon omasta konffista (Lähdeketju)

Sivupalkki näyttää kokeellisen ominaisuuden *Työtilan kuvake* ollessa päällä
jokaisen keskustelun edessä työtilan kuvakkeen. Käynnissä-osion toistuva
otsikkorivi poistuu, ja Työtilat-listan ja kapean kaistaleen kuvake on sama.
Kuvake luetaan ketjusta:

1. repon juuren commitoitu `.open-habitat.yaml`, kenttä `icon`: hymiö tai
   repon sisäinen kuvapolku (svg, png, webp, jpg);
2. ensimmäinen logo kiinteältä listalta: kansiot juuri, `public`, `static`,
   `assets`, `design-system`, `docs`, `web/public` ja `web/static`, nimet
   `logo.svg`, `favicon.svg`, `logo.png` ja `favicon.png` tässä järjestyksessä;
3. nimestä johdettu kirjaintunnus ja sävy, jotka selain laskee.

Kuvakkeen napautus avaa kortin, jossa ovat koko nimi, lähde,
*Avaa työtilasivu* ja *Uusi keskustelu*. Puhelimessa kortti on alapaneeli.
Asettamisen käyttöliittymä on erillinen prototyyppi
(`proto-workspace-icon-setting`).

Tarkistukset: `go test ./internal/daemon ./internal/gateway`,
contracts-tarkistus, web-alue (1002 testiä) sekä selainspecit
`lab-workspace-icons.spec.ts` (uusi), `settings-experimental.spec.ts`,
`lab-workspace-page.spec.ts` ja `lab-workspace-trash.spec.ts`.
Katselmointi: riippumaton `/llm-review` (etsijä gpt-6-astra, todentaja
claude-fable-5-1) ja `/assess-findings`. Kaksi vahvistettua löydöstä
korjattiin:

- kuvatiedosto luetaan nyt kiinnitetystä hakemistosta perusnimellä, eikä
  `readSmall` enää hyväksy kauttaviivallista nimeä, koska `fstatat` seuraisi
  välihakemiston symlinkkiä. Sama korjaus koski olemassa olevaa
  `.git/HEAD`-lukua (`worktree_places_linux.go`);
- kuvakkeet luetaan vain snapshotin listauksessa (`DiscoverListing`), eivät
  jokaisessa työtilan tunnistuksessa (`Discover`).

## Päätökset myöhempää tarkastelua varten

- **Konffin muoto: YAML ja `yaml.v3`.** Jari päätti tiedostoksi
  `.open-habitat.yaml`. Luen sen olemassa olevalla `go.yaml.in/yaml/v3`
  -riippuvuudella (enintään 16 KiB) enkä omalla rivinlukijalla. Muut kentät
  jätetään huomiotta, koska tiedosto on tarkoitettu kasvamaan muillekin
  asetuksille. Virheellinen tiedosto tai kelvoton `icon` tarkoittaa, ettei
  kuvaketta ole, ja ketju jatkuu logoon. Vaihtoehto olisi ollut näyttää
  virhe, mutta kuvake on koriste eikä saa estää työtilan käyttöä.
- **Hymiön raja.** Hyväksyn enintään 32 tavua ja 8 koodipistettä, joista
  ainakin yksi on ASCIIn ulkopuolelta. Välilyönnit ja ohjausmerkit hylätään,
  paitsi emoji-sekvenssien liitos- ja valitsinmerkit. Pelkät kirjaimet
  (`icon: OH`) eivät siis kelpaa hymiöksi. Kirjaintunnus tulee ketjun lopusta.
- **Konffin kuvapolku, jota ei ole, putoaa logoon.** Vaihtoehto oli jättää
  kuvake tyhjäksi. Valitsin logon, koska se on silti repon oma kuva.
- **Kuvan tarjoilu: kuvana, ei rasteroituna.** SVG tarjoillaan
  `image/svg+xml`-tyyppisenä `nosniff`-otsakkeella. Gateway lisää omaan
  reittiinsä CSP:n `sandbox; default-src 'none'; …`, ja selain näyttää
  kuvan vain `<img>`-elementissä, jossa skriptit eivät aja. Jos osoitteen
  avaa suoraan, sandbox estää skriptit. Rasterointi olisi tarvinnut uuden
  riippuvuuden. Daemon tarkistaa myös, että tiedoston alku vastaa päätettä
  (PNG-, JPEG- ja WebP-taikaluku, SVG:ssä `<svg`), ja tarjoilee kuvan
  enintään 256 KiB:n kokoisena. Selain ei koskaan nimeä polkua: reitti saa vain
  `workspace_id`:n ja välimuistiavaimen `v`, ja daemon valitsee kuvan
  repostaan uudelleen.
- **Logolista.** Prototyypin `favicon.svg`/`logo.svg` sekä PNG-muodot ja
  kahdeksan tavallista kansiota. Lista on kiinteä eikä hakemistoa kävellä.
- **Kirjaintunnus nimestä, joka näkyy.** Kirjaimet ja sävy johdetaan
  näyttönimestä (`display_name ?? name`), kuten prototyypissä. Yleisnimet,
  kuten `monorepo`, ohitetaan. Saman kirjain- ja sävyparin saanut ruutu
  siirtyy seuraavaan vapaaseen sävyyn aakkosjärjestyksessä. Sävyt ovat uusia
  tokeneita `--ah-glyph-0…7` (`design-system/tokens/colors.css`).
- **Kortin toiminnot.** Mukana ovat *Avaa työtilasivu* ja *Uusi keskustelu*.
  Prototyypin *Vaihda kuvake…* puuttuu, koska asettaminen on oma
  prototyyppinsä.
- **Keskustelun yläpalkki ja työtilasivun otsikko** jäivät ilman kuvaketta.
  Brief rajasi työn sivupalkkiin, kaistaleeseen ja puhelimeen. Ne on helppo
  lisätä samalla `WorkspaceIcon`-komponentilla.
- **Puhelimen alapaneelissa ei ole himmennystä.** Kortti on React Arian
  popover, jonka CSS asettaa puhelimessa alareunaan. Prototyypin taustan
  himmennys puuttuu.
- **Hiljaiset-taitoksen otsikko** näyttää kuvakkeen nimen edessä, ja nimi
  säilyy, kuten prototyypissä.
